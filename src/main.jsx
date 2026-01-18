import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MapPin, Globe, CheckCircle, X, Plus, Download, RefreshCw, Cloud, Lock } from 'lucide-react'
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
    const [suppliers, setSuppliers] = useState(initialData);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

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
        "Product Portfolio": ""
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
            "Product Portfolio": ""
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

    // LOGIN SCREEN
    if (!isAuthenticated) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <div className="login-header">
                        <Lock size={32} />
                        <h1>EcoAudit.ai</h1>
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

    // MAIN DASHBOARD
    return (
        <div className="app">
            <aside className="sidebar">
                <div className="brand">
                    <Globe size={20} style={{ color: '#22c55e' }} />
                    <span>EcoAudit.ai</span>
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
                <div className="modal-overlay" onClick={() => setSelectedSupplier(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-row">
                                <h2>{selectedSupplier["Supplier Name"]}</h2>
                                <button onClick={() => setSelectedSupplier(null)}><X /></button>
                            </div>
                            <div className="modal-subtitle">{selectedSupplier["Business Type"]} • {selectedSupplier["Company Size"]}</div>
                        </div>
                        <div className="modal-body">
                            <div className="modal-section"><h3>Materials</h3><p>{selectedSupplier["Materials"] || "N/A"}</p></div>
                            <div className="modal-section"><h3>Products</h3><p>{selectedSupplier["Product Portfolio"] || "N/A"}</p></div>
                            <div className="modal-section"><h3>Notes</h3><div className="evidence-box">{selectedSupplier["Evidence/Notes"]}</div></div>
                            <div className="modal-actions">
                                {selectedSupplier.Website && <a href={selectedSupplier.Website} target="_blank" rel="noreferrer" className="website-link"><Globe size={16} /> Website</a>}
                                <button className="delete-btn" onClick={() => handleRemoveCompany(selectedSupplier["Supplier Name"])}>Remove</button>
                            </div>
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
