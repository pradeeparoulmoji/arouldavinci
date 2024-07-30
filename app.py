from flask import Flask, request, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit_form', methods=['POST'])
def submit_form():
    name = request.form['name']
    email = request.form['email']
    subject = request.form['subject']
    message = request.form['message']
    
    # Save to a text file
    with open('submissions.txt', 'a') as file:
        file.write(f"Name: {name}, Email: {email}, Subject: {subject}, Message: {message}\n")
    
    return f"Received name: {name}, email: {email}, subject: {subject}, message: {message}"

if __name__ == '__main__':
    app.run(debug=True)