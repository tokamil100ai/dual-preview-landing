// Minimal QR code renderer using qrcodejs-like approach
// Uses a simple encoding for URLs - good enough for MVP
// Full implementation would use Reed-Solomon error correction

window.QRCode = null; // Will be set if a proper library is loaded

// For now, drawSimpleQR in app.js handles the fallback
