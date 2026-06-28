import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes/index';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(cors());
app.use(express.json());

app.use('/api', router);

// Express 5 async errors bubble up automatically; this catches sync and explicit next(err) calls
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
