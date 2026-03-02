const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const express = require('express');
const { randomUUID } = require('crypto');

const SQS_ENDPOINT = process.env.SQS_ENDPOINT || 'http://localhost:4566';
const QUEUE_A_URL = process.env.QUEUE_A_URL;
const QUEUE_B_URL = process.env.QUEUE_B_URL;

const PORT = process.env.PORT || 3002;

const TABLE = 'backend_b_events';

const sqs = new SQSClient({
  region: 'us-east-1',
  endpoint: SQS_ENDPOINT,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  forcePathStyle: true,
});

const dynamo = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: SQS_ENDPOINT,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  forcePathStyle: true,
});

async function pollQueueB() {
  if (!QUEUE_B_URL) {
    console.warn('QUEUE_B_URL not set, skipping SQS consumer');
    return;
  }
  const receive = async () => {
    try {
      const { Messages } = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_B_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 30,
      }));
      if (Messages && Messages.length > 0) {
        for (const msg of Messages) {
          const id = randomUUID();
          const receivedAt = new Date().toISOString();
          await dynamo.send(new PutItemCommand({
            TableName: TABLE,
            Item: {
              id: { S: id },
              body: { S: msg.Body || '' },
              message_id: { S: msg.MessageId || '' },
              received_at: { S: receivedAt },
            },
          }));
          await sqs.send(new DeleteMessageCommand({
            QueueUrl: QUEUE_B_URL,
            ReceiptHandle: msg.ReceiptHandle,
          }));
          console.log('Processed message from queue-b:', msg.MessageId);
          if (QUEUE_A_URL) {
            await sqs.send(new SendMessageCommand({
              QueueUrl: QUEUE_A_URL,
              MessageBody: JSON.stringify({ from: 'backend-b', originalId: msg.MessageId, at: receivedAt }),
            }));
          }
        }
      }
    } catch (err) {
      console.error('Receive error:', err.message);
    }
    setImmediate(receive);
  };
  receive();
}

const app = express();
app.use(express.json());

app.post('/send', async (req, res) => {
  if (!QUEUE_A_URL) return res.status(500).json({ error: 'QUEUE_A_URL not set' });
  const body = req.body?.body ?? req.body ?? 'hello from backend-b';
  try {
    const { MessageId } = await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_A_URL,
      MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
    }));
    res.json({ sent: true, messageId: MessageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/events', async (_req, res) => {
  try {
    const { Items } = await dynamo.send(new ScanCommand({
      TableName: TABLE,
      Limit: 100,
    }));
    const rows = (Items || []).map((item) => ({
      id: item.id?.S,
      body: item.body?.S ?? '',
      message_id: item.message_id?.S ?? '',
      received_at: item.received_at?.S ?? '',
    }));
    rows.sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function main() {
  console.log(`Using table ${TABLE}`);
  pollQueueB();
  app.listen(PORT, () => console.log(`backend-b listening on ${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
