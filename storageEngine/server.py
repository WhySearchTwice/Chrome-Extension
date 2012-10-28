from flask import Flask, request
import couchdb
import json
app = Flask(__name__)

# Config settings
COUCHDB_SERVER = 'http://localhost:5984/'
COUCHDB_DATABASE = 'capstone'

# CouchDB Views


# Flask Routes
@app.route('/capstone')
def home():
    return 'Hello World!'

@app.route('/capstone/pageview', methods=['POST'])
def savePageview():
    if request.method == 'POST':
        # Retrieve the data from the request
        requestData = request.data
        jsonRequestData = json.loads(requestData)
        
        # Save the doc in the database
        db.save(jsonRequestData)

        return 'Document Saved'
    return 'Invalid request type'

@app.route('/capstone/user/<username>')
def retrieveUserPageviews():
    # Currently this function ignores the username and retrieves all data
    
    allDocuments = []
    for id in db:
        # Add each item to list
        allDocuments.append(db[id])

    return json.dumps(allDocuments)

# Flask Main
if __name__ == '__main__':
    app.config.update(
        DEBUG = True
    )

    # CouchDB Setup
    couch = couchdb.Server(COUCHDB_SERVER)
    db = couch[COUCHDB_DATABASE]

    # Start Webserver
    app.run(host='0.0.0.0', port=5003)