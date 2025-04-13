# CryoTomoSnap

A quick viewer to browse through tomography data with a tagging system to search for data.

**NOTE:** Only basic features for now.

---

## 1. Installation Steps

```bash
git clone https://github.com/builab/CryoTomoSnap.git
cd CryoTomoSnap
```


Initialize a Node.js project:
```
npm init -y
```

Install required dependencies:
```
npm install express cors
npm install glob
```

Copy dataset containing images to micrographs
```
cp /path/to/your/png/files micrographs/
```

## 2. Run the Server

Start the server:
```
node server.js
```

You should see output like:
```
Server running on port 3000
```

## 3. Access the Application

Open a web browser and navigate to:
```
http://localhost:3000
```
