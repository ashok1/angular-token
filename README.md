# Notice

Original [README](https://github.com/neroniaky/angular-token)

We needed to fork this repository as it is not being maintained anymore (according to the npm entry).

To make it installable trough `npm i` we needed to add additional scripts to package.json:

## Build

```json
"build:lib": "rm -rf ./dist && ng-packagr -p ./projects/angular-token/ng-package.json"
```

This will do a clean package compile to the `./dist/angular-token` folder.

## Release

```json
"build:release": "npm run build:lib && tar -czvf ./dist/angular-token.tar.gz -C ./dist/angular-token ."
```

This will create a zipped tar file in `./dist/angular-token.tar.gz`

## Github release

After running a `npm run build:release` we'll need to create a release in github and attach the tar file to the release.

We can then use this new release using:

```sh
npm i https://github.com/Telleroo/angular-token/releases/download/v15.2.7/angular-token.tar.gz
```