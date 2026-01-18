const express = require('express');
const cors = require('cors');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_PATH = './src/data/suppliers.json';
const EXCEL_PATH = '../final_audit_ai_generated.xlsx';

// Check if company exists
app.post('/api/check', (req, res) => {
    const { companyName } = req.body;
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const exists = data.some(s =>
        s['Supplier Name'].toLowerCase().includes(companyName.toLowerCase())
    );
    res.json({ exists, count: data.length });
});

// Generate template for manual entry (no API needed!)
app.post('/api/search', async (req, res) => {
    const { companyName } = req.body;

    // Return a template that user can fill in
    // No Gemini API call - works offline!
    const template = {
        "Supplier Name": companyName,
        "Company Size": "Small/Medium Business",  // User can change
        "Business Type": "Manufacturer",           // User can change
        "Materials": "",                           // User fills in
        "Bagasse Focus": "Unknown",
        "Verified": "Likely",
        "Evidence/Notes": "Manually added via dashboard",
        "Location": "",                            // User fills in
        "Website": "",                             // User fills in
        "Product Portfolio": ""                    // User fills in
    };

    res.json(template);
});

// Add new company to data
app.post('/api/add', (req, res) => {
    const newCompany = req.body;

    try {
        // Read current data
        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

        // Check for duplicates
        const exists = data.some(s =>
            s['Supplier Name'].toLowerCase() === newCompany['Supplier Name'].toLowerCase()
        );
        if (exists) {
            return res.status(400).json({ error: 'Company already exists' });
        }

        // Add to JSON
        data.push(newCompany);
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

        // Update Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Master List");
        XLSX.writeFile(wb, EXCEL_PATH);

        res.json({ success: true, totalSuppliers: data.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log('Mode: Manual Entry (no Gemini API required)');
});
