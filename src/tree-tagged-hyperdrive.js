const hyperdrive = require('hyperdrive')
const Hyperbee = require('hyperbee')
const { Header } = require('hyperbee/lib/messages')
const Corestore = require('corestore')
const events = require('events')
const ram = require('random-access-memory')

class TreeTaggedHyperdrive extends events.EventEmitter {
  constructor (key, opts = {}) {
    super()

    const self = this
    this._ready = new Promise((resolve, reject) => {
      self.on('ready', () => {
        resolve()
      })
    })
    this._initialized = new Promise((resolve, reject) => {
      self.on('initialized', () => {
        resolve()
      })
    })
    this._initialize(key, opts)
  }

  async _initialize (key, opts) {
    if (opts.corestore === undefined || opts.corestore === null) {
      this.corestore = new Corestore(ram)
    } else {
      this.corestore = opts.corestore
    }
    await this.corestore.ready()
    if (key !== undefined && key !== null) {
      this._initializeFromExisting(key, opts)
    } else {
      this._initializeNew(opts)
    }
  }

  async _initializeNew (opts) {
    const self = this
    this.drive = hyperdrive(this.corestore)
    this.userData = opts.userData
    this.drive.on('ready', async function () {
      const treeMetadata = {
        contentFeed: self.drive.metadata.key,
        userData: self.userData
      }
      self.tree = new Hyperbee(self.corestore.get({ name: 'tree' }), {
        keyEncoding: 'utf-8',
        valueEncoding: 'binary',
        metadata: treeMetadata
      })
      await self.tree.ready()
      self.emit('initialized')
      self.emit('ready')
    })
  }

  async _initializeFromExisting (key, opts) {
    const self = this
    this.tree = new Hyperbee(this.corestore.get({ key: key }), {
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    })
    await this.tree.ready()
    self.emit('initialized')
    await this.tree.feed.get(0, async function (err, data) {
      if (err) throw err
      const header = Header.decode(data)
      self.userData = header.metadata.userData.toString()
      self.drive = hyperdrive(self.corestore, header.metadata.contentFeed)
      await self.drive.ready()
      self.emit('ready')
    })
  }

  async ready () {
    return this._ready
  }

  async initialized () {
    return this._initialized
  }

  async put (tag, version = this.drive.version) {
    await this.tree.put(tag, version.toString())
  }

  async getVersionAtTag (tag) {
    return await this.tree.get(tag)
  }

  async getDriveAtTag (tag) {
    const node = await this.getVersion(tag)
    if (node) {
      return this.drive.checkout(node.value.toString())
    }
    return null
  }

  getKey () {
    return this.tree.feed.key
  }

  replicate (isInitiator, opts) {
    return this.corestore.replicate(isInitiator, opts)
  }

  getDrive () {
    return this.drive
  }

  getTree () {
    return this.tree
  }
}

module.exports = TreeTaggedHyperdrive
