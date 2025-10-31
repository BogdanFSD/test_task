
import { fetchAllWithConcurrency } from "./fetchAllWithConcurrency.js";

async function main() {

const urls = [
  "https://postman-echo.com/delay/3",
  "https://postman-echo.com/delay/1",
  "https://postman-echo.com/delay/2",
  "https://postman-echo.com/delay/1",
  "https://postman-echo.com/delay/3"
];

  const max = Number(process.env.MAX_CONCURRENCY ?? 2);
  console.time(`fetchAllWithConcurrency(max=${max})`);
  const responses = await fetchAllWithConcurrency(urls, max);
  const statuses = responses.map(r => r.status);
  console.timeEnd(`fetchAllWithConcurrency(max=${max})`);
  console.log("Statuses (order preserved):", statuses);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
