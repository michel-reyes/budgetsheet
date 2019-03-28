const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const alasql = require('alasql');
const firebase = require("firebase");
require("firebase/firestore");

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  //authorize(JSON.parse(content), transactions);
  authorize(JSON.parse(content)).then( async function(auth) {

    // initialize firestore
    firebase.initializeApp({
      apiKey: "AIzaSyCI4gz3IYr8wUOyYv3d_9rg2Na0OfiQDjg",
      authDomain: "budgetme-c4e90.firebaseapp.com",
      projectId: "budgetme-c4e90"
    });

    var db = firebase.firestore();

    // Get data from spreadsheets
    const t = await transactions(auth);
    const c = await categories(auth);
    
    var res = alasql(`
      SELECT * 
      FROM ? t
      JOIN ? c
      ON t.category = c.subcategories`,
      [t, c]);

    res.forEach(item => {
      db.collection("transactions").add({
          name: item.description,
          amount: item.amount,
          balance: item.balance || 0.00,
          category: item.categories,
          subcategory: item.subcategories,
          date: item.date,
          rule: item.rule || 'Income',
      })
      .then(function(docRef) {
          console.log("Document written with ID: ", docRef.id);
      })
      .catch(function(error) {
          console.error("Error adding document: ", error);
      });
    });
    
  });
  
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  return new Promise(function(resolve) {
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client);
      oAuth2Client.setCredentials(JSON.parse(token));
      //callback(oAuth2Client);
      resolve(oAuth2Client);
    });
  })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Store the transactions in array of objects from budget/transactions spreadsheet
 * @see https://docs.google.com/spreadsheets/d/1RKi462Tbm_8B3kwPyPLMsIdCNKDWPSq3ybRALV5qoxI/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function transactions(auth) {
  return new Promise(function(resolve, reject) {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: '1RKi462Tbm_8B3kwPyPLMsIdCNKDWPSq3ybRALV5qoxI',
      range: 'Transactions!A1:E',
    }, (err, res) => {
      if (err) return console.log('On transactions. The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        // Headers
        // Date	Description	Category	Amount	Balance
                
        // Store columns A to E, which correspond to indices 0 to 4.
        const transactionList = [];
        rows.map((row, index) => {
          if (index > 0) {
            transactionList.push({
              date: row[0],
              description: row[1],
              category: row[2],
              amount: row[3],
              balance: row[4]
            });
          }
        });
        resolve(transactionList);
      } else {
        console.log('No data found.');
        reject('not found');
      }
    });    
  });  
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function categories(auth) {
  return new Promise(function(resolve, reject) {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: '1RKi462Tbm_8B3kwPyPLMsIdCNKDWPSq3ybRALV5qoxI',
      range: 'Categories!A1:D',
    }, (err, res) => {
      if (err) return console.log('On categories. The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        // Headers
        // Id	Categories	Subcategories	Rule

        // Print columns A to E, which correspond to indices 0 to 4.
        const categoryList = [];
        rows.map((row, index) => {
          if (index > 0) {
            categoryList.push({
              id: row[0],
              categories: row[1],
              subcategories: row[2],
              rule: row[3]
            });
          }          
        });
        resolve(categoryList);
      } else {
        console.log('No data found.');
        reject('not found');
      }
    });    
  });  
}