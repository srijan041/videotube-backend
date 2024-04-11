Step 1:

# Project setup

* npm init
* Adding project structure
* Config package.json
* Configure nodemon, git, prettier on a project scale

## Project Structure

* public/
  * temp/
* src/
  * controllers
    * .gitkeep
  * middlewares
    * gitkeep
  * db
    * gitkeep
  * models
    * gitkeep
  * routes
    * gitkeep
  * utils
    * gitkeep
  * app.js
  * constant.js
  * index.js

# MongoDB

### cluster0

ID: gunzerker41

pass: usual with cluster name (no special characters)

# dotenv

Setup dotenv as import not require (modular js style).

But in order to do that, we need to change our start script. 

Add the following as option in nodemon command: -r dotenv/config --experimental-json-modules
