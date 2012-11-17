from flask import Flask, request
import couchdb
import json
import uuid
app = Flask(__name__)

# Config settings
COUCHDB_SERVER = 'http://localhost:5984/'
COUCHDB_DATABASE = 'capstone'

# CouchDB Views


# Flask Routes
@app.route('/')
def home():
    return 'Hello World!'


@app.route('/guid')
def generateGuid():
    newUuid = uuid.uuid1()
    return str(newUuid)


@app.route('/cleanup')
def cleanup():
    # Clean up any items in the database that do not have a userId
    for docId in db:
        # Don't delete the design documents
        if docId.startswith("_design"):
            continue

        doc = db[docId]
        if "userId" not in doc:
            db.delete(doc)
    return "All clean"


@app.route('/pageview', methods=['POST'])
def savePageview():
    if request.method == 'POST':
        # Retrieve the data from the request
        requestData = request.data
        jsonRequestData = json.loads(requestData)

        # Save the doc in the database
        db.save(jsonRequestData)

        return 'Document Saved'
    return 'Invalid request type'


@app.route('/user/<userId>')
def retrieveUserPageviews(userId=None):
    allDocuments = []
    for row in db.view('pageView/by_userId'):
        # Add each item to list
        allDocuments.append(row)

    return json.dumps(allDocuments)

# Flask Main
if __name__ == '__main__':
    app.config.update(
        DEBUG=True
    )

    # CouchDB Setup
    couch = couchdb.Server(COUCHDB_SERVER)
    db = couch[COUCHDB_DATABASE]

    # Start Webserver
    app.run(host='0.0.0.0', port=80)
