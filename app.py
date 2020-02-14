import sqlite3, os
from flask import Flask, flash, redirect, render_template, request, session, abort, g, url_for, jsonify
from functools import wraps
import secrets
from pprint import pprint

app = Flask(__name__, static_url_path="/", static_folder="static")

UPLOADS_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOADS_PATH

app.secret_key = os.urandom(12)

Database = 'data.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(Database)
    return db


def query_db(query, args=(), one=False):  # used to retrive values from the table
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):  # executes a sql command like alter table and insert
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    cur.close()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.route('/')
def index():
    get_db()
    return "Test"

@app.route('/graph/<data>',methods=['GET', 'POST'])
def graph(data):
    if request.method == "GET":
        data = query_db("select name,data from graph where name = ?", (data,))
        if not(data):
            return "graph doesnt exist"
        return render_template("graph.html",graph_name=data[0][0])
    else:
        execute_db("update graph set data=? where name= ? ",(str(request.json).replace("'",'"') ,data))
        return ""
    

@app.route('/graph/<name>/data')
def graph_data(name):
    data = query_db("select name,data from graph where name = ?", (name,))
    if not(data):
        return "graph doesnt exist"
    return str(data[0][1]).replace("'",'"')

def get_random_string():
    return secrets.token_urlsafe(32)

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=8080)