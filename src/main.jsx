import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MapPin, Globe, CheckCircle, X, Plus, Download, RefreshCw, Cloud, Lock, Edit3 } from 'lucide-react'
import * as XLSX from 'xlsx'
import initialData from './data/suppliers.json'
import './index.css'

// SheetDB API - Use environment variable in production
const SHEETDB_API = import.meta.env.VITE_SHEETDB_API || 'https://sheetdb.io/api/v1/xx4d7t49drhqj';

// Company password - In production, set VITE_APP_PASSWORD in Vercel
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'earthworks2024';

const App = () => {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    // Check if already logged in (session storage)
    useEffect(() => {
        const session = sessionStorage.getItem('ecoaudit_auth');
        if (session === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    // Login handler
    const handleLogin = (e) => {
        e.preventDefault();
        if (password === APP_PASSWORD) {
            setIsAuthenticated(true);
            sessionStorage.setItem('ecoaudit_auth', 'true');
            setAuthError('');
        } else {
            setAuthError('Incorrect password');
        }
    };

    // Dashboard state
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedSupplier, setEditedSupplier] = useState(null);

    // Load data from Google Sheets on startup
    useEffect(() => {
        const loadFromSheets = async () => {
            try {
                const res = await fetch(SHEETDB_API);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setSuppliers(data);
                    } else {
                        // Fallback to local JSON if sheet is empty
                        setSuppliers(initialData);
                    }
                } else {
                    setSuppliers(initialData);
                }
            } catch (err) {
                console.error('Failed to load from Sheets, using local data:', err);
                setSuppliers(initialData);
            }
            setIsLoading(false);
        };
        loadFromSheets();
    }, []);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newCompany, setNewCompany] = useState({
        "Supplier Name": "",
        "Company Size": "Small/Medium Business",
        "Business Type": "Manufacturer",
        "Materials": "",
        "Bagasse Focus": "Unknown",
        "Verified": "Likely",
        "Evidence/Notes": "Manually added",
        "Location": "",
        "Website": "",
        "Product Portfolio": "",
        "MOQ": ""
    });

    const categories = ['All', 'Bagasse', 'Paper', 'Bioplastics', 'Glass', 'Metal', 'Mycelium', 'Bamboo'];

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const matchSearch = s["Supplier Name"].toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s["Product Portfolio"] && s["Product Portfolio"].toLowerCase().includes(searchQuery.toLowerCase()));
            const matchCat = activeCategory === 'All' || (s.Materials && s.Materials.includes(activeCategory));
            return matchSearch && matchCat;
        });
    }, [searchQuery, activeCategory, suppliers]);

    const syncAddToSheet = async (company) => {
        try {
            await fetch(SHEETDB_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: company })
            });
            setSyncStatus('✓ Synced');
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) {
            setSyncStatus('⚠ Sync failed');
        }
    };

    const syncDeleteFromSheet = async (companyName) => {
        try {
            await fetch(`${SHEETDB_API}/Supplier Name/${encodeURIComponent(companyName)}`, {
                method: 'DELETE'
            });
            setSyncStatus('✓ Removed');
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) {
            setSyncStatus('⚠ Sync failed');
        }
    };

    const syncUpdateToSheet = async (oldName, updatedCompany) => {
        try {
            await fetch(`${SHEETDB_API}/Supplier Name/${encodeURIComponent(oldName)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: updatedCompany })
            });
            setSyncStatus('✓ Updated');
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) {
            setSyncStatus('⚠ Sync failed');
        }
    };

    const syncAllToSheet = async () => {
        setIsSyncing(true);
        setSyncStatus('Syncing...');
        try {
            await fetch(`${SHEETDB_API}/all`, { method: 'DELETE' });
            await fetch(SHEETDB_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: suppliers })
            });
            setSyncStatus('✓ All synced!');
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) {
            setSyncStatus('⚠ Sync failed');
        }
        setIsSyncing(false);
    };

    const handleAddCompany = async () => {
        if (!newCompany["Supplier Name"].trim()) {
            alert("Please enter a company name");
            return;
        }
        const exists = suppliers.some(s =>
            s["Supplier Name"].toLowerCase() === newCompany["Supplier Name"].toLowerCase()
        );
        if (exists) {
            alert("Company already exists!");
            return;
        }
        setSuppliers([...suppliers, newCompany]);
        await syncAddToSheet(newCompany);
        setNewCompany({
            "Supplier Name": "",
            "Company Size": "Small/Medium Business",
            "Business Type": "Manufacturer",
            "Materials": "",
            "Bagasse Focus": "Unknown",
            "Verified": "Likely",
            "Evidence/Notes": "Manually added",
            "Location": "",
            "Website": "",
            "Product Portfolio": "",
            "MOQ": ""
        });
        setShowAddModal(false);
    };

    const handleRemoveCompany = async (companyName) => {
        if (window.confirm(`Remove "${companyName}"?`)) {
            setSuppliers(suppliers.filter(s => s["Supplier Name"] !== companyName));
            setSelectedSupplier(null);
            await syncDeleteFromSheet(companyName);
        }
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(suppliers);
        XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
        XLSX.writeFile(wb, "supplier_audit.xlsx");
    };

    const handleEditSupplier = () => {
        setEditedSupplier({ ...selectedSupplier });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!editedSupplier["Supplier Name"].trim()) {
            alert("Supplier name is required");
            return;
        }
        const oldName = selectedSupplier["Supplier Name"];
        const updatedSuppliers = suppliers.map(s =>
            s["Supplier Name"] === oldName ? editedSupplier : s
        );
        setSuppliers(updatedSuppliers);
        setSelectedSupplier(editedSupplier);
        await syncUpdateToSheet(oldName, editedSupplier);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedSupplier(null);
    };

    // LOGIN SCREEN
    if (!isAuthenticated) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <div className="login-header">
                        <Lock size={32} />
                        <h1>Supplier Table</h1>
                        <p>Supplier Intelligence Dashboard</p>
                    </div>
                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            placeholder="Enter company password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                        />
                        {authError && <div className="login-error">{authError}</div>}
                        <button type="submit" className="login-btn">Access Dashboard</button>
                    </form>
                    <p className="login-footer">Authorized personnel only</p>
                </div>
            </div>
        );
    }

    // LOADING SCREEN
    if (isLoading) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <RefreshCw size={32} className="spinner" style={{ color: '#F4D58D' }} />
                    <h2 style={{ marginTop: '1rem' }}>Loading suppliers...</h2>
                </div>
            </div>
        );
    }

    // MAIN DASHBOARD
    return (
        <div className="app">
            <aside className="sidebar">
                <div className="brand">
                    <Globe size={20} style={{ color: '#F4D58D' }} />
                    <span>Supplier Table</span>
                </div>
                <div className="filter-group">
                    <div className="filter-title">Categories</div>
                    {categories.map(cat => (
                        <button key={cat} className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}>{cat}</button>
                    ))}
                </div>
                <div className="action-buttons">
                    <button className="add-company-btn" onClick={() => setShowAddModal(true)}>
                        <Plus size={16} /> Add Company
                    </button>
                    <button className="sync-btn" onClick={syncAllToSheet} disabled={isSyncing}>
                        {isSyncing ? <RefreshCw size={16} className="spinner" /> : <Cloud size={16} />}
                        {isSyncing ? 'Syncing...' : 'Sync to Sheets'}
                    </button>
                    <button className="export-btn" onClick={handleExport}>
                        <Download size={16} /> Export Excel
                    </button>
                </div>
                {syncStatus && <div className="sync-status">{syncStatus}</div>}
            </aside>

            <main className="main">
                <header className="header">
                    <input type="text" placeholder="Search suppliers..." className="search-bar"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <div className="stats">
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{filteredSuppliers.length}</span> suppliers
                    </div>
                </header>
                <div className="content">
                    <div className="grid">
                        {filteredSuppliers.map((s, idx) => (
                            <div key={idx} className="card" onClick={() => setSelectedSupplier(s)}>
                                <div className="card-header">
                                    <div className="card-title">{s["Supplier Name"]}</div>
                                    {s.Verified === "Yes" && <div className="badge verified"><CheckCircle size={12} /></div>}
                                </div>
                                <div className="card-body">
                                    <div className="info-row"><MapPin size={14} /><span>{s.Location || "Unknown"}</span></div>
                                    <div className="portfolio-text">{s["Product Portfolio"]}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {selectedSupplier && (
                <div className="modal-overlay" onClick={() => { setSelectedSupplier(null); setIsEditing(false); }}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-row">
                                <h2>{isEditing ? "Edit Supplier" : selectedSupplier["Supplier Name"]}</h2>
                                <button onClick={() => { setSelectedSupplier(null); setIsEditing(false); }}><X /></button>
                            </div>
                            {!isEditing && <div className="modal-subtitle">{selectedSupplier["Business Type"]} • {selectedSupplier["Company Size"]}</div>}
                        </div>
                        <div className="modal-body">
                            {isEditing ? (
                                <div className="edit-form">
                                    <label>Company Name *</label>
                                    <input value={editedSupplier["Supplier Name"]} onChange={e => setEditedSupplier({ ...editedSupplier, "Supplier Name": e.target.value })} />

                                    <label>Company Size</label>
                                    <select value={editedSupplier["Company Size"]} onChange={e => setEditedSupplier({ ...editedSupplier, "Company Size": e.target.value })}>
                                        <option>Startup</option><option>Small Enterprise</option><option>Small/Medium Business</option><option>Midsize Enterprise</option>
                                    </select>

                                    <label>Business Type</label>
                                    <select value={editedSupplier["Business Type"]} onChange={e => setEditedSupplier({ ...editedSupplier, "Business Type": e.target.value })}>
                                        <option>Manufacturer</option><option>Manufacturer/Trader</option><option>Distributor</option><option>Brand</option><option>Brand/Tech</option><option>Tech Innovator</option>
                                    </select>

                                    <label>Materials</label>
                                    <input value={editedSupplier["Materials"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "Materials": e.target.value })} placeholder="Bagasse, Paper, Bioplastics..." />

                                    <label>Bagasse Focus</label>
                                    <select value={editedSupplier["Bagasse Focus"] || "Unknown"} onChange={e => setEditedSupplier({ ...editedSupplier, "Bagasse Focus": e.target.value })}>
                                        <option>Primary</option><option>Secondary</option><option>None</option><option>Unknown</option>
                                    </select>

                                    <label>Verified</label>
                                    <select value={editedSupplier["Verified"] || "Likely"} onChange={e => setEditedSupplier({ ...editedSupplier, "Verified": e.target.value })}>
                                        <option>Yes</option><option>Likely</option><option>Unclear (No Website)</option>
                                    </select>

                                    <label>Location</label>
                                    <input value={editedSupplier["Location"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "Location": e.target.value })} />

                                    <label>Website</label>
                                    <input value={editedSupplier["Website"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "Website": e.target.value })} placeholder="https://..." />

                                    <label>Product Portfolio</label>
                                    <input value={editedSupplier["Product Portfolio"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "Product Portfolio": e.target.value })} />

                                    <label>MOQ (Minimum Order Quantity)</label>
                                    <input value={editedSupplier["MOQ"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "MOQ": e.target.value })} placeholder="e.g., 500 units, 1000 pcs, 50kg..." />

                                    <label>Notes / Evidence</label>
                                    <input value={editedSupplier["Evidence/Notes"] || ""} onChange={e => setEditedSupplier({ ...editedSupplier, "Evidence/Notes": e.target.value })} />

                                    <div className="preview-actions" style={{ marginTop: '1.5rem' }}>
                                        <button onClick={handleCancelEdit} className="cancel-btn">Cancel</button>
                                        <button onClick={handleSaveEdit} className="confirm-btn">Save Changes</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="modal-section"><h3>Materials</h3><p>{selectedSupplier["Materials"] || "N/A"}</p></div>
                                    <div className="modal-section"><h3>Products</h3><p>{selectedSupplier["Product Portfolio"] || "N/A"}</p></div>
                                    <div className="modal-section"><h3>MOQ</h3><p>{selectedSupplier["MOQ"] || "Not specified"}</p></div>
                                    <div className="modal-section"><h3>Notes</h3><div className="evidence-box">{selectedSupplier["Evidence/Notes"]}</div></div>
                                    <div className="modal-actions">
                                        {selectedSupplier.Website && <a href={selectedSupplier.Website} target="_blank" rel="noreferrer" className="website-link"><Globe size={16} /> Website</a>}
                                        <button className="edit-btn" onClick={handleEditSupplier}><Edit3 size={16} /> Edit</button>
                                        <button className="delete-btn" onClick={() => handleRemoveCompany(selectedSupplier["Supplier Name"])}>Remove</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal add-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-row"><h2>Add Company</h2><button onClick={() => setShowAddModal(false)}><X /></button></div>
                        </div>
                        <div className="modal-body">
                            <div className="edit-form">
                                <label>Company Name *</label>
                                <input value={newCompany["Supplier Name"]} onChange={e => setNewCompany({ ...newCompany, "Supplier Name": e.target.value })} />
                                <label>Size</label>
                                <select value={newCompany["Company Size"]} onChange={e => setNewCompany({ ...newCompany, "Company Size": e.target.value })}>
                                    <option>Startup</option><option>Small Enterprise</option><option>Small/Medium Business</option><option>Midsize Enterprise</option>
                                </select>
                                <label>Type</label>
                                <select value={newCompany["Business Type"]} onChange={e => setNewCompany({ ...newCompany, "Business Type": e.target.value })}>
                                    <option>Manufacturer</option><option>Distributor</option><option>Brand</option><option>Tech Innovator</option>
                                </select>
                                <label>Materials</label>
                                <input value={newCompany["Materials"]} onChange={e => setNewCompany({ ...newCompany, "Materials": e.target.value })} placeholder="Bagasse, Paper..." />
                                <label>Location</label>
                                <input value={newCompany["Location"]} onChange={e => setNewCompany({ ...newCompany, "Location": e.target.value })} />
                                <label>Website</label>
                                <input value={newCompany["Website"]} onChange={e => setNewCompany({ ...newCompany, "Website": e.target.value })} />
                                <label>Products</label>
                                <input value={newCompany["Product Portfolio"]} onChange={e => setNewCompany({ ...newCompany, "Product Portfolio": e.target.value })} />
                                <label>MOQ (Minimum Order Quantity)</label>
                                <input value={newCompany["MOQ"]} onChange={e => setNewCompany({ ...newCompany, "MOQ": e.target.value })} placeholder="e.g., 500 units, 1000 pcs..." />
                            </div>
                            <div className="preview-actions">
                                <button onClick={() => setShowAddModal(false)} className="cancel-btn">Cancel</button>
                                <button onClick={handleAddCompany} className="confirm-btn">Add</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
