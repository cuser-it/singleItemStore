import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const app = await createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`backend listening on http://localhost:${port}`);
});
