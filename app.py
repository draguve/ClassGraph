import json
import os
import secrets

import psycopg2
from flask import Flask, redirect, render_template, request, g, url_for

app = Flask(__name__, static_url_path="/", static_folder="static")

UPLOADS_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOADS_PATH

app.secret_key = os.urandom(12)

DB_NAME = os.environ.get("DB_NAME", "classgraph")
DB_USER = os.environ.get("DB_USER", "draguve")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PASS = os.environ.get("DB_PASS", "pioneer123")


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = psycopg2.connect(
            "dbname='{0}' user='{1}' host='{2}' password='{3}'".format(DB_NAME, DB_USER,
                                                                       DB_HOST, DB_PASS))
    return db


def query_db(query, args=(), one=False):  # used to retrive values from the table
    conn = get_db()
    cur = conn.cursor()
    query = query.format(*args)
    cur.execute(query)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def execute_db(query, args=()):  # executes a sql command like alter table and insert
    conn = get_db()
    cur = conn.cursor()
    query = query.format(*args)
    cur.execute(query)
    conn.commit()
    cur.close()


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route('/')
def index():
    all_graphs = query_db("select graph_name from graph")
    return render_template("explorer.html", all_graphs=all_graphs)


@app.route('/addnew', methods=['POST'])
def add_new():
    graph_name = request.form["fname"]
    if graph_name.strip() == "":
        return redirect(url_for('index'))
    check = query_db("select * from graph where graph_name = '{0}'", (graph_name,))
    if len(check) > 0:
        return redirect(url_for("index"))
    empty = {"nodes": [], "links": []}
    execute_db("insert into graph values('{0}','{1}')", (graph_name, json.dumps(empty).replace("'", '"')))
    return redirect(url_for("graph", data=graph_name))


@app.route('/delete/<id>', methods=['POST'])
def delete(id):
    check = query_db("select * from graph where name = '{0}'", (id,))
    if len(check) > 0:
        return redirect(url_for("index"))
    fo = open("backup_" + id + os.urandom(5) + ".txt", "wb")
    fo.write(check[0][1])
    execute_db("DELETE FROM graph where graph_name = '{0}'", (id,))
    return redirect(url_for("index"))


@app.route('/graph/<data>', methods=['GET', 'POST'])
def graph(data):
    if request.method == "GET":
        data = query_db("select graph_name,graph_data from graph where graph_name = '{0}'", (data,))
        if not data:
            return "graph doesnt exist"
        return render_template("graph.html", graph_name=data[0][0])
    else:
        execute_db("update graph set graph_data='{0}' where graph_name= '{1}' ",
                   (str(request.json).replace("'", '"'), data))
        return ""


@app.route('/graph/<name>/data')
def graph_data(name):
    data = query_db("select graph_name,graph_data from graph where graph_name = '{0}'", (name,))
    if not data:
        return "graph doesnt exist"
    return str(data[0][1]).replace("'", '"')


def get_random_string():
    return secrets.token_urlsafe(32)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=8080)
