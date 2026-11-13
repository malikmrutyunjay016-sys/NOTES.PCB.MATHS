import 'dotenv/config';
import express from 'express';
import path from 'path';
import { apiRouter } from './src/server/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/api', apiRouter);

// Serve static frontend build
app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Notes application running on http://localhost:${PORT}`);
});
