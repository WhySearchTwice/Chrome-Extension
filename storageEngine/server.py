from flask import flask
app = Flask(__name__)

@app.route('/')
def home():
	return 'Hello World!'

if __name__ == '__main__':
	app.debug = True
	app.run(host='0.0.0.0')