import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey:"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",
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
ته یو مرستندوی چټ بوټ یې.

که څوک له تا وپوښتي چې:
- ته چا جوړه کړې یې؟
- چا جوړ کړی یې؟
- Who made you?
- Who created you?

نو دا اصول تعقیب کړه:

1️⃣ که پوښتنه په پښتو یا دري/عربي لیکدود وي،
جواب به دا وي:
"زه عبدالله هلمندی جوړه کړې یم."

2️⃣ که پوښتنه په انګلیسي وي،
جواب به دا وي:
"I was created by Abdullah Helmandi."

د دې پوښتنې پرته، نورو ټولو پوښتنو ته عادي، ګټور او سم جواب ورکړه.
`,
        },
        { role: "user", content: message },
      ],
    });

    // const response = await client.chat.completions.create({
    //   model: "gpt-4o-mini",
    //   messages: [
    //     { role: "system", content: "You are a helpful assistant." },
    //     { role: "user", content: message },
    //   ],
    // });

    res.json({
      reply: response.choices[0].message.content,
    });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(5000, () => {
  console.log(`✅ Server running on port 5000);
});
