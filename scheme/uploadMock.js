const admin = require("firebase-admin");
const data = require("./data.json");


if (process.env.NODE_ENV === "development") {
  // this is how it runs in local dev
  require("dotenv").config();
  admin.initializeApp();
  db = admin.firestore();
} else {

  var serviceAccount = null; 
  if (process.env.FIREBASE_SECRET) {
    // this is how github actions deploys data to staging
    serviceAccount = JSON.parse(process.env.FIREBASE_SECRET)
  }
  else {
    // this is how to deploy data from local to staging 
    // (but you need to get ./serviceAccount.json first)
    serviceAccount = require("./serviceAccount.json"); 
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mutualaid-757f6.firebaseio.com",
  });
  db = admin.firestore();
}
/**
 * Data is a collection if
 *  - it has a odd depth
 *  - contains only objects or contains no objects.
 */
function isCollection(data, path, depth) {
  if (typeof data != "object" || data == null || data.length === 0 || isEmpty(data)) {
    return false;
  }

  for (const key in data) {
    if (typeof data[key] != "object" || data[key] == null) {
      // If there is at least one non-object item in the data then it cannot be collection.
      return false;
    }
  }
  if (Array.isArray(data)) {
    return false;
  }

  return true;
}

// Checks if object is empty.
function isEmpty(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

async function upload(data, path) {
  return await db
    .doc(path.join("/"))
    .set(data)
    .then(() => console.log(`Document ${path.join("/")} uploaded.`))
    .catch((e) => {
      console.error(`Could not write document ${path.join("/")}.`);
      console.log(e);
    });
}

/**
 *
 */
async function resolve(data, path = []) {
  if (path.length > 0 && path.length % 2 == 0) {
    // Document's length of path is always even, however, one of keys can actually be a collection.

    // Copy an object.
    const documentData = Object.assign({}, data);

    for (const key in data) {
      // Resolve each collection and remove it from document data.
      if (isCollection(data[key], [...path, key])) {
        // Remove a collection from the document data.
        delete documentData[key];
        // Resolve a colleciton.
        await resolve(data[key], [...path, key]);
      }
    }

    // If document is empty then it means it only consisted of collections.
    if (!isEmpty(documentData)) {
      // Upload a document free of collections.
      await upload(documentData, path);
    }
  } else {
    // Collection's length of is always odd.
    for (const key in data) {
      // Resolve each collection.
      await resolve(data[key], [...path, key]);
    }
  }
}

resolve(data);
