import { createServer } from "node:http";
const messages = [];
createServer(async (req, res) => {
  if (req.method === "POST") {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    try {
      const message = JSON.parse(Buffer.concat(chunks).toString());
      messages.push(message);
      res.writeHead(204).end();
    } catch {
      res.writeHead(400).end();
    }
  } else {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(messages));
  }
}).listen(8025, "127.0.0.1", () =>
  process.stdout.write("Development-only mailbox: http://127.0.0.1:8025\n"),
);
