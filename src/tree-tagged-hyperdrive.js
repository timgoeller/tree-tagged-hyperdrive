const hyperdrive = require('hyperdrive')
const Hyperbee = require('hyperbee')
const { Header } = require('hyperbee/lib/messages')
const Corestore = require('corestore')
const events = require('events')
const ram = require('random-access-memory')

class TreeTaggedHyperdrive extends events.EventEmitter {
  constructor (key, opts = {}) {
    super()
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

    this.drive.on('ready', async function () {
      const semverMetadata = {
        contentFeed: self.drive.metadata.key,
        userData: opts.userData
      }
      self.semverTree = new Hyperbee(self.corestore.get({ name: 'semver-tree' }), {
        keyEncoding: 'utf-8',
        valueEncoding: 'binary',
        metadata: semverMetadata
      })
      await self.semverTree.ready()
      self.emit('ready')
    })
  }

  async _initializeFromExisting (key, opts) {
    const self = this
    this.semverTree = new Hyperbee(this.corestore.get({ key: key }), {
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    })
    await this.semverTree.ready()
    await this.semverTree.feed.get(0, async function (err, data) {
      if (err) throw err
      const header = Header.decode(data)
      self.drive = hyperdrive(self.corestore, header.metadata.contentFeed)
      await self.drive.ready()
      self.emit('ready')
    })
    self.emit('ready')
  }

  async ready () {
    const self = this
    return new Promise((resolve, reject) => {
      self.on('ready', () => {
        resolve()
      })
    })
  }

  async pushVersion (semanticVersion) {
    const currentCoreVersion = this.drive.version
    this.semverTree.put(semanticVersion, currentCoreVersion.toString())
  }

  getKey () {
    return this.semverTree.feed.key
  }

  replicate (isInitiator, opts) {
    return this.corestore.replicate(isInitiator, opts)
  }

  getDrive () {
    return this.drive
  }
}

module.exports = TreeTaggedHyperdrive
