const uuid = require('uuid/v4');
const debug = require('debug');
const Proto = require('uberproto');
const errors = require('@feathersjs/errors');

const CouchbaseService = require('feathers-couchbase').Service;

// TODO: Add cas support
class CouchbaseOdmService extends CouchbaseService {
  constructor (options) {
    if (!options.keySpace) {
      return 'no keySpace for this service?';
    }
    super(options);
    this.keySpace = options.keySpace;
  }
  extend (obj) {
    return Proto.extend(obj, this);
  }
  setup (app, path) {
    this.app = app;
    this.path = path;
    super.setup(app, path);
  }
  find (params) {
    debug('feathers-couchbase-odm::find::info')(params);
    if (!this.keySpace) {
      return Promise.reject(new errors.GeneralError('no keySpace for this service?'));
    }

    params.query._type = this.keySpace;
    debug('feathers-couchbase-odm::find::info')(params);
    return this._find(params).then((data) => {
      data.filter((itm) => {
        if (itm.cbKey) {
          if (itm.cbKey === itm._type + '|' + itm._id) {
            debug('feathers-couchbase-odm::find::info::NotFiltered')(itm);
            return itm;
          } else {
            debug('feathers-couchbase-odm::find::warning::filtered')(itm);
          }
        }
      });
      return data;
    });
  }
  get (id, params) {
    if (Array.isArray(id)) {
      debug('feathers-couchbase-odm::get::multi')(id, params);
    } else {
      debug('feathers-couchbase-odm::get::single')(id, params);
    }

    return super.get(this.keySpace + '|' + id);
    // .then((res)=>res[0]);
    // return this._query({ _id: id, _type: this.keySpace}).then((res)=>res[0]);
  }
  create (data, params) {
    if (data._id) {
      debug('feathers-couchbase-odm::create::warning')('DEPRECATED: Called with id set %s', data._id);
    }
    if (data._type) {
      debug('feathers-couchbase-odm::create::warning')('DEPRECATED: Called with type set %s', data._type);
    }

    return this._create(this._createKey(data), params);

    /*
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current,params)));
    }
    */
  }
  // update is single patch is mult
  update (id, data) {
    debug('feathers-couchbase-odm::update')(id, this._getKey(id), data);
    return super.update(this._getKey(id), data);
  }
  patch (id, data, params) {
    return this._patch(this._getKey(id), params);
  }
  remove (id, params) {
    debug('feathers-couchbase-odm::remove')(id, this._getKey(id), params);
    return this._remove(this._getKey(id), params)
      .catch((e) => {
        if (e.code === 13) {
          debug('feathers-couchbase-odm::remove::Warning::KeyNotFoundTryId')(id, this._getKey(id), params);
          return this._remove(id, params);
        }
        debug('feathers-couchbase-odm::remove::error')(e);
      });
  }
  _queryOdm (filter) {
    // var QUERY = 'SELECT *, META(val).id FROM default val WHERE META(val).id LIKE "'+query+'%" ';
    delete filter._type;

    // var FILTER_ARRAY = [' WHERE val._type LIKE "Artist"'];
    var FILTER_ARRAY = [' WHERE META(val).id LIKE "' + this.keySpace + '%"'];
    Object.keys(filter).map((key) => FILTER_ARRAY.push('val.' + key + ' LIKE "' + filter[key] + '"'));
    var QUERY = 'SELECT *, META(val).id FROM default val' + FILTER_ARRAY.join(' AND ');
    debug('feathers-couchbase-odm:_queryOdm')(QUERY);
    return 'DEPERECATED';
    // return db.runQuery(QUERY).then((res)=>res.map((itm)=>itm.val));
  }
  _getKey (id) {
    var keySpaceId = this.keySpace + '|' + id;
    debug('feathers-couchbase-odm:_getKey')(keySpaceId);
    return keySpaceId;
  }
  _createKey (data, params) {
    // TODO: if params use that key
    if (data._id === undefined) {
      data._id = uuid();
    }
    if (data._type === undefined) {
      data._type = this.keySpace;
    }
    var cbKey = data._type + '|' + data._id;
    debug('feathers-couchbase-odm:_createKey')(cbKey, params);
    data.cbKey = cbKey;
    return data;
  }
}
// const Couchbase = new couchbaseService();
// module.exports = Couchbase;
export default function init (options) {
  return new CouchbaseOdmService(options);
}

init.Service = CouchbaseOdmService;
// app.use('couchbase',new couchbaseService('artist-'));
