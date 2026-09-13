const express = require('express');
const path = require('path');
const { TransactionStatusEngine } = require('./models/transactionStatusEngine');
const createTransactionRouter = require('./routes/transactions');
const createExchangeRouter = require('./routes/exchange');

const app = express();
const PORT = process.env.PORT || 3000;

// Single shared engine instance for now (in-memory store).
// Later: swap TransactionStatusEngine's internal store for a real DB.
const engine = new TransactionStatusEngine();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/transactions', createTransactionRouter(engine));
app.use('/api/exchange', createExchangeRouter());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Build My Crypto server running on http://localhost:${PORT}`);
});

module.exports = app; // exported for tests
