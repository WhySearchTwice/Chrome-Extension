from flask import Flask, request
from flaskext.couchdb import CouchDBManager
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
        print request.data

    return 'A work in progress'

# Flask Main
if __name__ == '__main__':
    app.config.update(
        DEBUG = True,
        COUCHDB_SERVER = COUCHDB_SERVER,
        COUCHDB_DATABASE = COUCHDB_DATABASE
    )

    # CouchDB Setup
    manager = CouchDBManager()
    manager.setup(app)

    # Install Views


    # Sync Database
    manager.sync(app)

    # Start Webserver
    app.run(host='0.0.0.0', port=5003)