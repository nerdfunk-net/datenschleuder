rm -rf ./node-1/repos/content_repository 
rm -rf ./node-1/repos/database
rm -rf ./node-1/repos/flowfile
rm -rf ./node-1/repos/provenance_repository
rm -rf ./node-1/state/local
rm -f ./node-1/logs/*
rm ./node-1/conf/users.*
rm ./node-1/conf/authorizations.*
cp ./node-1/conf/flow.json.gz ./node-2/conf/flow.json.gz
cp ./node-1/conf/flow.json.gz ./node-3/conf/flow.json.gz

rm -rf ./node-2/repos/content_repository 
rm -rf ./node-2/repos/database
rm -rf ./node-2/repos/flowfile
rm -rf ./node-2/repos/provenance_repository
rm -rf ./node-2/state/local
rm -f ./node-2/logs/*
rm ./node-2/conf/users.*
rm ./node-2/conf/authorizations.*

rm -rf ./node-3/repos/content_repository 
rm -rf ./node-3/repos/database
rm -rf ./node-3/repos/flowfile
rm -rf ./node-3/repos/provenance_repository
rm -rf ./node-3/state/local
rm -f ./node-3/logs/*
rm ./node-3/conf/users.*
rm ./node-3/conf/authorizations.*
