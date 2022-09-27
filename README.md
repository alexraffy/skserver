# skserver
 
This is the server part of the SKSQL library: https://github.com/alexraffy/sksql

### build

    npm run 02-skserver-build

## Quick launch
Directly

    node build/main.js --dbPath=PATH_TO_EMPTY_FOLDER --port=30001 --alive=0

In a container:
    
    podman run --detach --rm=true --network="host" --volume=PATH:/data --env SKWORKER_PORT=30001 skeletapp/skserver:latest node build/main.js
    
    or with docker

    docker run --detach --rm=true --network="host" --volume=PATH:/data --env SKWORKER_PORT=30001 skeletapp/skserver:latest node build/main.js

    
## Usage

    node build/main.js [options]

    Server Mode
    Required parameters:
    --dbPath=               Path to the database folder.
    --port=                 Port number for the websocket.
    Optional server parameters:
    --encryption=KEY        An optional key for encrypting/decrypting the db.
    --7z=PATH               Path to the 7z executable for backing up.
    --tokenList=PATH        Path to a flat file containing a list of tokens.
    
    Relay Mode
    Required parameters:
    --relay=                WS address of the server.
    --port=                 Port number for the websocket.
    Optional relay parameter:
    --relayToken=           Token to authenticate with the distant server.
    
    Other parameters:
    --id=                   The server unique id.
    --alive=                Number of seconds before shutting down due to inactivity.
    --heartbeat=            WS address of the monitor.
    --remoteonly=YES/NO     If set to YES, clients will not receive a copy of the db.
    --readonly=YES/NO       If set to YES, no data can be modified with CREATE/INSERT/UPDATE/DELETE/DROP.
    
    Parameters can also be set with ENVIRONMENT VARS:
    SKSERVER_DBPATH         Server Mode: Path to the database folder.
    SKSERVER_PORT           Port number for the websocket.
    SKSERVER_RELAY          Relay Mode: WS address of the server to connect to.
    SKSERVER_RELAYTOKEN     Relay Mode: Token to authenticate with the distant server.
    SKSERVER_ID             The server unique id.
    SKSERVER_ALIVE          Number of seconds before shutting down due to inactivity.
    SKSERVER_7Z             Server Mode: Path to the 7z executable for backing up.
    SKSERVER_ENCRYPTION     Server Mode: An optional key for encrypting/decrypting the db.
    SKSERVER_HEARTBEAT      ws address of the monitor.
    SKSERVER_REMOTEONLY     If set to YES, clients will not receive a copy of the db.
    SKSERVER_READONLY       If set to YES, no data can be modified with CREATE/INSERT/UPDATE/DELETE/DROP.
    SKSERVER_TOKENLIST      Path to a flat file containing a list of tokens.


## Authentication

Client connections can be forced to authenticate with a token.

To do so a token file must be created and passed to the server. This file is monitored and the server will reload it if it is modified.

Tokens entries are separated by a colon.
Each entry must contain
- a GUID 
- a ISO-8601 date for expiry (UTC and without space)
- a right access (R, W or RW)

Example of a valid entry: 
    
    c853d25a-77d7-40c6-8279-f85c418e248f 2022-09-27T09:40:23Z RW

Example of valid token file

    c853d25a-77d7-40c6-8279-f85c418e248f 2022-09-27T09:40:23Z RW, 89b95ea7-24c3-49ba-b081-1a807022e70c 2022-09-27T10:40:23Z R



## Backing up Data

The server will generate a zip file of the database on every launch in DBPATH/backups

Path to a 7z executable can be specified with --7z=PATH or with environment variable SKSERVER_7Z

## Encryption

If an encryption key is provided with --encryption=KEY or with the env var SKSERVER_ENCRYPTION, the database blocks will be encrypted. 

Subsequent launches of the server MUST contain the encryption key or the data will not be readable. 

Existing database cannot be encrypted without being totally recreated.

## Remote Only & Read Only

If remote only is enabled, the database will not be sent to client connections and queries will be only processed on the server.

If read only is enabled, the database will be sent to client connections but no data can be modified on the server.


## Relay Mode

The server can be launched in relay mode to load-balance connections.

    node build/main.js --relay=ws://127.0.0.1:30001 --port=30002


