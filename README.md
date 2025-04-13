CryoTomoSnap

1. Installation Steps
Create a project directory:

git clone 
cd micrograph-viewer

Initialize a Node.js project:
npm init -y

Install required dependencies:
npm install express cors


Create the server file:
Create a file named server.js in your project directory
Copy the contents from the "Compatible Node.js Server" code I provided
Create a directory for the frontend:
mkdir -p public

Create a directory for micrographs:
 mkdir micrographs

2. Run the Server
Start the server:
node server.js
You should see output like:
Server running on port 3000
Serving micrographs from: /your/path/to/micrograph-viewer/micrographs

4. Add Your Micrographs
Copy your PNG micrographs to the micrographs directory:
cp /path/to/your/png/files/*.png micrographs/

5. Access the Application
Open a web browser and navigate to:
http://localhost:3000
