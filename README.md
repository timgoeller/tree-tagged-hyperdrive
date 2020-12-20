# Tree Tagged Hyperdrive
This is a hyperdrive with a hyperbee on top. Every node in the hyperbee refers to a version of the hyperdrive. It's only required to share one key, because the hyperdrive key is stored in the hyperbee metadata, and setup is automatically done by this module.

## Example
In this example two tagged hyperdrives are created. The first one is piped into the second one, so they return the same data. The same file is inserted into the first hyperdrive three times, each time with different data. Each time the file is inserted, an entry in the tree with a different version tag is created. Then all versions greater than `1.0.0` are requested and the content of their `hello.txt` is printed.

```js
const TreeTaggedHyperdrive = require('tree-tagged-hyperdrive')

const treeTaggedHyperdrive1 = new TreeTaggedHyperdrive()

start()

async function start () {
  await treeTaggedHyperdrive1.ready()
  
  const treeTaggedHyperdrive2 = new TreeTaggedHyperdrive(treeTaggedHyperdrive1.getKey())

  const stream = treeTaggedHyperdrive1.replicate(true, { live: true })
  stream.pipe(treeTaggedHyperdrive2.replicate(false, { live: true })).pipe(stream) 

  await treeTaggedHyperdrive2.ready()

  await new Promise((resolve,reject) => {
    treeTaggedHyperdrive1.drive.writeFile('/hello.txt', 'brave', async function (err) {
      await treeTaggedHyperdrive1.put('0.0.1')
      treeTaggedHyperdrive1.drive.writeFile('/hello.txt', 'new', async function (err) {
        await treeTaggedHyperdrive1.put('1.0.0')
        treeTaggedHyperdrive1.drive.writeFile('/hello.txt', 'world', async function (err) {
          await treeTaggedHyperdrive1.put('1.1.0')

          const rs = await treeTaggedHyperdrive2.tree.createReadStream({ gte: '1.0.0' })
          rs.on('data', async (chunk) => {
            console.log('I found a version matching that query.');
            const drive = treeTaggedHyperdrive2.drive.checkout(chunk.value.toString())
            await drive.ready()
            drive.readFile('hello.txt', function (err, data) {
              console.log('I found a version matching that query: ' + chunk.key.toString())
              console.log('hello.txt contains this: ' + data.toString())
              if(data.toString() == 'world') {
                resolve()
              }
            })
          });
        })
      })
    })
  })
}
```

## API
#### `const treeTaggedHyperdrive = new TreeTaggedHyperdrive([key], [opts])`

Make a new tagged hyperdrive. `key` can be a reference to a hyperbee instance.

`opts` can be:

```
  {
    corestore: <custom corestore to use>
    userData: <data to add to the hyperbee metadata>
  }
```

#### `await treeTaggedHyperdrive.ready()`
Wait for initialization to be complete.

#### `await treeTaggedHyperdrive.put(tag, <version>)`
Add an entry to the tree, refering to a hyperdrive version. If no version is supplied, the current drive version will be used.

#### `await treeTaggedHyperdrive.getVersionAtTag(tag)`
Get the hyperdrive version stored at the supplied tag.

#### `await treeTaggedHyperdrive.getDriveAtTag(tag)`
Get a checkout of the hyperdrive at the version specified by the supplied tag.

#### `treeTaggedHyperdrive.getKey()`
Get the key of this tagged hyperdrive. Can be used for replication.

#### `treeTaggedHyperdrive.replicate(isInitiator, opts)`
Returns a stream for replication. `opts` are the same as for corestore replication.

#### `treeTaggedHyperdrive.getDrive()`
Get the hyperdrive.

#### `treeTaggedHyperdrive.getTree()`
Get the hyperbee.