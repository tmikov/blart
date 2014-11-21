/// <reference path="../typings/tsd.d.ts" />

export = StrMap;

class StrMap<T> {
    private _size: number = 0;
    private _map:{[index: string]: T} = {};

    get size():number { return this._size; }

    clear (): void {
        this._size = 0;
        this._map = {};
    }

    set( key, val: T ): void  {
      var mkey = mangle(key);
      if (!(mkey in this._map))
        ++this._size;
      this._map[mkey] = val;
    }

    get ( key ): T {
      return this._map[mangle(key)];
    }

    has ( key ): boolean {
      return mangle(key) in this._map;
    }

    delete ( key ): void {
      var mkey = mangle(key);
      if (mkey in this._map)
        --this._size;
      delete this._map[mkey];
    }

    keys (): string[] {
      var res: string[] = [];
      for ( var t in this._map )
        res.push( demangle(t) );
      return res;
    }

    values (): T[] {
      var res: T[] = [];
      for ( var t in this._map )
        res.push( this._map[t] );
      return res;
    }

    forEach ( callbackFn: (val: T, key: string, map: StrMap<T> ) => void, thisArg? ): void {
      for ( var mkey in this._map )
        callbackFn.call( thisArg, this._map[mkey], demangle(mkey), this );
    }
}

function mangle ( s ): string {
  return ':' + s.toString();
}

function demangle ( s: string ): string {
  return s.substring(1);
}

