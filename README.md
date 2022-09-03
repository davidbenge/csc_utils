# CSC Utils

This is a collection of utils to help motivate Content Supply Chain along

## API call to create a presigned url
POST   
/api/v1/web/dx-excshell-1/get-presigned-storage-url  

Parameters  
**filePath**: path for storage in the store 'mypath/secondpath/thirdpath'  
**fileName**: target file name myfile.jpg  
**expiryInSeconds**: value in seconds before the url becomes invalid  
**permissions**: permission for the url in rwd
**cecUtilKey**: This key is used to store reference to the request and can be used to help move files into AEM 
``` javascript
{
    "filePath":"test",
    "fileName":"test.jpg",
    "expiryInSeconds":360,
    "permissions":"rw",
    "cecUtilKey":"myReferenceKey"
}
```
Results Example 
``` javascript
{
    "expiryInSeconds": 360,
    "permissions": "rw",
    "presignedPath": "test/test.jpg",
    "presignedUrl": "https://firefly.azureedge.net/40434af8ab5775fd5e79f42c261cdff9/test%2Ftest.jpg?sv=2019-02-02&se=2022-08-18T05%3A25%3A29Z&si=0ce1dba4-dd5b-4cd9-ad97-24c7276f1b61&sr=b&sp=rw&sig=GP4h3H0VeYaLSRMO6TNJi5d6lcmeoV0bRdmSPYzl5bQ%3D"
}
```


## API call to create a presigned url
POST   
/api/v1/web/dx-excshell-1/make-aem-presigned-url

Parameters  
**aemFilePath**: path for storage in the store '/assets.html/content/dam/abstergo/dss/originals/episodic/proof_template/test.jpeg'  
**expiryInSeconds**: value in seconds before the url becomes invalid  
**permissions**: permission for the url in rwd
``` javascript
{
    "aemFilePath":"/assets.html/content/dam/abstergo/dss/originals/episodic/proof_template/test.jpeg",
    "expiryInSeconds":360,
    "permissions":"w"
}
```
Results Example 
``` javascript
{
    "aemFilePath": "/assets.html/content/dam/abstergo/dss/originals/episodic/proof_template/test.jpeg",
    "expiryInSeconds": 360,
    "permissions": "w",
    "preSignUrl": "/api/v1/web/dx-excshell-1/ba3e05bd3a71d"
}
```