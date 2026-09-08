import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import nanoid from 'nanoid';
dns.setServers(['8.8.8.8', '1.1.1.1']);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE;
const collectionName = 'shortenedURLs';
const urlDocumentValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['original_url', 'short_id', 'clicks'],
    properties: {
      original_url: { bsonType: 'string', minLength: 1 },
      short_id: { bsonType: 'string', minLength: 1 },
      clicks: { bsonType: 'int', minimum: 0 },
    },
  },
};

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')))

const client = new MongoClient(databaseUrl);

async function startServer() {
  try {
    await client.connect();
    const db = client.db('shortener');
    try {
      await db.createCollection(collectionName, {
        validator: urlDocumentValidator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } catch (err) {
      if (err.code !== 48 && err.codeName !== 'NamespaceExists') throw err;
      await db.command({
        collMod: collectionName,
        validator: urlDocumentValidator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }

    const shortenedURLs = db.collection(collectionName);
    await Promise.all([
      shortenedURLs.createIndex({ original_url: 1 }, { unique: true }),
      shortenedURLs.createIndex({ short_id: 1 }, { unique: true }),
    ]);
    app.locals.db = db;
    console.log('Connected successfully to MongoDB');

    app.set('port', process.env.PORT || 4100);
    const server = app.listen(app.get('port'), () => {
      console.log(`Express running → PORT ${server.address().port}`);
    });
  } catch (err) {
    console.error('Failed to connect to the database', err);
    process.exit(1);
  }
}

const shortenURL = async (db, url) => {
  const shortenedURLs = db.collection(collectionName);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await shortenedURLs.findOneAndUpdate({ original_url: url },
        {
          $setOnInsert: {
            original_url: url,
            short_id: nanoid(7),
            clicks: 0,
          },
        },
        {
          returnDocument: 'after',
          upsert: true,
        }
      );
      return (result && result.value !== undefined) ? result.value : result;
    } catch (err) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
};

const getAndIncrementClickCount = (db, code) => db.collection(collectionName)
  .findOneAndUpdate(
    { short_id: code },
    { $inc: { clicks: 1 } },
    { returnDocument: 'after' }
  );

const sendUrlResponse = (res, doc, statusCode = 200) => res.status(statusCode).json({
  original_url: doc.original_url,
  short_id: doc.short_id,
});

const createShortenedUrl = async (req, res, statusCode) => {
  try {
    const originalUrl = new URL(req.body?.url);
    if (!['http:', 'https:'].includes(originalUrl.protocol)) {
      return res.status(400).send({ error: 'Only HTTP and HTTPS URLs are supported' });
    }

    await dns.promises.lookup(originalUrl.hostname);
    const { db } = req.app.locals;
    const doc = await shortenURL(db, originalUrl.href);
    return sendUrlResponse(res, doc, statusCode);
  } catch (err) {
    if (err instanceof TypeError || err.code === 'ENOTFOUND') {
      return res.status(400).send({ error: 'Invalid or unreachable URL' });
    }

    console.error(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
};

const findUrl = (db, code) => db.collection(collectionName)
  .findOne({ short_id: code });

const deleteUrl = (db, code) => db.collection(collectionName)
  .findOneAndDelete({ short_id: code });

app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(htmlPath);
})

app.post('/new', (req, res) => createShortenedUrl(req, res, 200));

app.post('/api/urls', (req, res) => createShortenedUrl(req, res, 201));

app.get('/api/urls/:short_id', async (req, res) => {
  try {
    const doc = await findUrl(req.app.locals.db, req.params.short_id);
    if (!doc) return res.status(404).send({ error: 'URL not found' });

    return res.json({
      original_url: doc.original_url,
      short_id: doc.short_id,
      clicks: doc.clicks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});

app.delete('/api/urls/:short_id', async (req, res) => {
  try {
    const result = await deleteUrl(req.app.locals.db, req.params.short_id);
    const doc = (result && result.value !== undefined) ? result.value : result;
    if (!doc) return res.status(404).send({ error: 'URL not found' });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});

app.get('/:short_id', (req, res) => {
  const shortId = req.params.short_id;

  const { db } = req.app.locals;
  getAndIncrementClickCount(db, shortId)
    .then(result => {
      const doc = (result && result.value !== undefined) ? result.value : result;
      if (!doc) return res.send('Uh oh. We could not find a link at that URL');

      res.redirect(doc.original_url)
    })
    .catch(err => {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    });
});

app.get('/api/analytics/:short_id', (req, res) => {
  const shortId = req.params.short_id;
  const { db } = req.app.locals;

  db.collection(collectionName).findOne({ short_id: shortId })
    .then(doc => {
      if (doc === null) return res.status(404).send({ error: 'URL not found' });

      res.json({
        original_url: doc.original_url,
        short_id: doc.short_id,
        clicks: doc.clicks || 0,
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    });
});

startServer();
