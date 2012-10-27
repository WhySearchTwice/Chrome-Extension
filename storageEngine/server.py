from flask import Flask, request

app = Flask(__name__)


# CouchDB Views


# Flask Routes
@app.route('/capstone')
def home():
    return 'Hello World!'

@app.route('/capstone/pageview', methods=['POST'])
def savePageview():
    if request.method == 'POST':
        # Retrieve the data from the request
        postData = request.json

        # Validate the request contained JSON
        if postData is None:
            return 'Invalid request type. Expecting mimetype application/json'

    return 'A work in progress'

# Flask Main
if __name__ == '__main__':
    app.config.update(
        DEBUG = True,
        COUCHDB_SERVER = 'http://localhosts:5985',
        COUCHDB_DATABASE = 'capstone'
    )

    # CouchDB Setup
    manager = flaskext.couchdb.CouchDBManagger()
    manager.setup(app)

    # Install Views


    # Sync Database
    manager.sync(app)

    # Start Webserver
    app.run(host='0.0.0.0', port=5003)