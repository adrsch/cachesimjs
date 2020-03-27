class CacheEntry {
    constructor( valid=0, tag=0 ) {
        this.valid = valid;
        this.tag = tag;
    }

    display( 
        formatField=function( field ) { return field.toString( 16 ) + " "; } 
    ) {
        return (
            formatField( this.valid ) +
            formatField( this.tag )
        );
    }
}

CacheEntry.displayLabels = function( 
    formatField=function( field ) { return field + " "; }
) {
    return (
        formatField( 'valid' ) +
        formatField( 'tag' )
    );
}

class LRUCacheEntry extends CacheEntry{
    constructor( valid=0, tag=0, lru=0 ) {
        super( valid, tag );
        this.lru = lru;
    }

    incrementLRU() {
        if ( valid ) {
            this.lru++;
        }
    }

    display( 
        formatField=function( field ) { return field.toString( 16 ) + " "; } 
    ) {
        return (
            super.display( formatField ) +
            formatField( this.lru )
        );
    }
}

LRUCacheEntry.displayLabels = function( 
    formatField=function( field ) { return field + " "; }
) {
    return (
        formatField( 'valid' ) +
        formatField( 'tag' ) +
        formatField( 'lru' )
    );
}

class dirtyBitLRUCacheEntry extends LRUCacheEntry{
    constructor( valid=0, tag=0, lru=0, dirty=0 ) {
        super( valid, tag );
        this.lru = lru;
        this.dirty = dirty;
    }

    display( 
        formatField=function( field ) { return field.toString( 16 ) + " "; } 
    ) { 
        return (
            super.display( formatField ) +
            formatField( this.dirty )
        );
    }
}

dirtyBitLRUCacheEntry.displayLabels = function( 
    formatField=function( field ) { return field + " "; }
) {
    return (
        formatField( 'valid' ) +
        formatField( 'tag' ) +
        formatField( 'lru' ) +
        formatField( 'dirty' )
    );
}

class Cache {
    constructor( cacheSize, blockSize, setSize, cacheEntry, next=null ) {
        if ( !this.isPower2( cacheSize ) ) { throw "Cache size must be power of 2"; }
        if ( !this.isPower2( blockSize ) ) { throw "Block size must be power of 2"; }
        if ( !this.isPower2( setSize ) ) { throw "Set associativity must be power of 2"; }

        this.cacheSize = cacheSize;
        this.blockSize = blockSize;
        this.setSize = setSize;
        this.cacheEntry = cacheEntry;
        this.next = next;

        this.blocks = cacheSize / blockSize;
        this.sets = this.blocks / setSize;
        this.indexBits = Math.log2( this.sets );
        this.offsetBits = Math.log2( blockSize );
        this.tagBits = 32 - this.indexBits - this.offsetBits;

        this.cache = new Array( this.sets );
        for ( var index = 0; index < this.sets; index++ ) {
            this.cache[index] = new Array( this.setSize );
            for ( var id = 0; id < this.setSize; id++ ) {
                this.cache[index][id] = new cacheEntry();
            }
        }

        this.hits = 0;
        this.misses = 0;
    }
    
    isPower2( value ) {
        return value && !( value & ( value - 1 ) );
    }

    getHits() { return this.hits; }
    getMisses() { return this.misses; }

    displayCacheInfo( 
        formatInfo=function( info ) { return info + '\n'; }
    ) {
        return ( 
            formatInfo( "Cache size: " + this.cacheSize ) +
            formatInfo( "Block size: " + this.blockSize ) +
            formatInfo( "# Blocks: " + this.blocks ) +
            formatInfo( "Set associativity: " + this.setSize ) +
            formatInfo( "# Sets: " + this.sets ) +
            formatInfo( "Index bits: " + this.indexBits ) +
            formatInfo( "Offset bits: " + this.offsetBits ) +
            formatInfo( "Tag bits: " + this.tagBits )
        );
    }

    displayHitInfo( 
        formatInfo=function( info ) { return info + '\n'; }
    ) {
        return (
            formatInfo( "Hits: " + this.hits ) +
            formatInfo( "Misses: " + this.misses ) +
            formatInfo( "Hit rate: " + this.hits / ( this.hits + this.misses ) )
        );
    }
    
    getIndex( address ) {
        if ( this.indexBits === 0 ) { return 0; } // Fully associative case 
        return ( address >>> this.offsetBits ) & ( 0xFFFFFFFF >>> ( this.offsetBits + this.tagBits ) );
    }

    getOffset( address ) {
        return address & ( 0xFFFFFFFF >>> ( 32 - this.offsetBits ) );
    }

    getTag( address ) {
        return address >>> ( this.indexBits + this.offsetBits );
    }

    split( address ) {
        var unsignedAddress = parseInt( addressHex, 16 ) >>> 0;
        var tag = this.getTag( unsignedAddress );
        var index = this.getIndex( unsignedAddress );
        var offset = this.getOffset( unsignedAddress );
        return [ tag, index, offset ];
    }

    display( 
        formatRow=function( contents ) { return contents + '\n'; },
        formatCol=function( contents ) { return contents.toString( 16 ) + ' '; }
    ) {
        var entries = formatRow(
            formatCol( 'set' ) +
            this.cacheEntry.displayLabels( formatCol ) 
        );
        for ( var set = 0; set < this.sets; set++ ) {
            for ( var id = 0; id < this.setSize; id++ ) {
                entries += formatRow(
                    formatCol( set ) +
                    this.cache[set][id].display( formatCol )
                );
            }
        }
        return entries;
    }

    readHit( set, tag, id ) { }
    readMiss( set, tag, id ) { }
    writeHit( set, tag, id ) { }
    writeMiss( set, tag, id ) { }
    getReplacementId( set, tag ) { }

    locate( set, tag ) {
        for ( var id = 0; id < this.setSize; id++ ) {
            if ( this.cache[set][id].valid == 1 && this.cache[set][id].tag == tag ) {
                return id;
            }
        }
        return null;
    }

    write( set, tag ) {
        var id = this.locate( set, tag );
        if ( id !== null ) {
            this.cache.hits++;
            this.writeHit( set, tag, id );
        }
        else { 
            this.cache.misses++;
            this.writeMiss( set, tag );
        }
    }
    
    writeAddress( address ) {
        var attr = this.split( address );
        var tag = attr[0];
        var set = attr[1];
        this.write( set, tag );
    }

    read( set, tag ) {
        var id = this.locate( set, tag );
        if ( id !== null ) {
            this.cache.hits++;
            this.readHit( set, tag, id );
        }
        else { 
            this.cache.misses++;
            this.readMiss( set, tag );
        }
    }
    
    readAddress( address ) {
        var attr = this.split( address );
        var tag = attr[0];
        var set = attr[1];
        this.read( set, tag );
    }
}

class LRUCache extends Cache {
    getLRUId( set ) {
        var replaceId = 0;
        for ( var entryId = 0; entryId < this.setSize; entryId++ ) {
            if ( this.cache[set][replaceId].lru < this.cache[set][replaceId].lru ) {
                replaceId = entryId;
            }
        }
        return replaceId;
    }

    replaceLRU( set, tag ) {
        var id = this.getLRUId( set );
        var replaced = this.cache[set][id];
        this.cache[set][id] = new this.cacheEntry( 1, tag, 0 );
    }

    use( set, tag, id ) {
        if ( this.cache[set][id].lru === 0 ) { return; }
        for ( var entryId = 0; entryId < id; entryId++ ) {
            if ( this.cache[set][entryId].lru < this.cache[set][id].lru ) {
                this.cache[set][entryId].incrementLRU();
            }
        }
        this.cache[set][id].lru = 0;
    }
}

// Note: no-write-allocate
class WriteThroughLRU extends LRUCache {
    constructor( cacheSize, blockSize, setSize, next=null ) {
        super( cacheSize, blockSize, setSize, LRUCacheEntry, next=null );
    }

    writeHit( set, tag, id ) {
        this.use( set, tag, id );
        if ( this.next ) { 
            this.next.write( set, tag ); 
        }
    }

    writeMiss( set, tag ) {
        if ( this.next ) { 
            this.next.write( set, tag ); 
        }
    }
    
    readHit( set, tag, id ) {
        this.use( set, tag, id );
    }

    readMiss( set, tag ) {
        this.replaceLRU( set, tag );
        if ( this.next ) { 
            this.next.read( set, tag ); 
        }
    }
}

// Note: fetch on write
class WriteBackLRU extends LRUCache {
    constructor( cacheSize, blockSize, setSize, next=null ) {
        super( cacheSize, blockSize, setSize, dirtyBitLRUCacheEntry, next=null );
    }

    replaceLRU( set, tag, dirty=0 ) {
        var id = this.getLRUId( set );
        var replaced = this.cache[set][id];
        this.cache[set][id] = new this.cacheEntry( 1, tag, 0, dirty );
        if ( replaced.dirty == 1 ) {
            next.write( replaced.set, replaced.tag );
        }
    }

    writeHit( set, tag, id ) {
        this.use( set, tag, id );
        this.cache[set][id].dirty = 1;
    }

    writeMiss( set, tag ) {
        var id = this.getLRUId( set, tag );
        var replaced = this.replaceLRU( set, tag );
        this.cache[set][id].dirty = 1;
    }
    
    readHit( set, tag, id ) {
        this.use( set, tag, id );
    }

    readMiss( set, tag, id ) {
        this.replaceLRU( set, tag );
        if ( this.next ) { 
            this.next.read( set, tag ); 
        }
    }
}

class MemorySystem {
}
// Run a single instruction
function runInstruction( type, address, dataCache, instructionCache ) {
    if ( type == 'lw' || type == 0 ) {
        dataCache.readAddress( address );
    }
    else if ( type == 'write' || type == 1 ) {
        dataCache.writeAddress( address );
    }
    else if ( type == 'readi' || type == 2 ) {
        instructionCache.readAddress( address );
    }
}

// Read trace of memory references to a data and instruction cache
function read( trace, dataCache, instructionCache ) {
    traceEntries = trace.toString().split("\n");
    traceEntries.forEach( function( entry ) {
        reference = entry.split( " " );
        runInstruction( reference[0], reference[1], dataCache, instructionCache ); 
    });
}

 

// Generate an instruction type as an int: 0, 1, or 2
function generateType() {
    return Math.floor( Math.random() * 4 ) + 1;
}

// Generate an address
function generateAddress() {
    var randomIntArray = new Uint32Array( 1 );
    window.crypto.getRandomValues( randomIntArray );
    return toHex( randomIntArray[0] );
}

function amat2( l1d, l1i, h, m ) {
    return h + ( ( ( l1d.getMisses() + l1i.getMisses() ) / ( l1d.getMisses() + l1i.getMisses() + l1d.getHits() + l1i.getHits() ) ) * m );
}

function amatL2( l1d, l1i, l2, l1h, l2h, l2m ) {
    return l1h + ( ( ( l1d.getMisses() + l1i.getMisses() ) / ( l1d.getMisses() + l1i.getMisses() + l1d.getHits() + l1i.getHits() ) ) * ( l2h + ( l2.getMisses() / ( l2.getHits() + l2.getMisses() ) ) * l2m ) );
}



function csv( print, l1d, l1i, h, m ) {
    print( l1d.assoc + "," + ( l1i.getHits() + l1i.getMisses() ) + "," + l1i.getMisses() + "," + ( l1d.getHits() + l1d.getMisses() ) + "," + l1d.getMisses() + "," + ( l1i.getHits() / ( l1i.getHits() + l1i.getMisses() ) ) + "," + ( l1d.getHits() / ( l1d.getHits() + l1d.getMisses() ) ) + "," + amat2( l1d, l1i, h, m ) );
}

function csv3( print, l1d, l1i, l2, l1h, l2h, l2m, p ) {
    print( p + "," + ( l1i.getHits() + l1i.getMisses() ) + "," + l1i.getMisses() + "," + ( l1d.getHits() + l1d.getMisses() ) + "," + l1d.getMisses() + "," + ( l1i.getHits() / ( l1i.getHits() + l1i.getMisses() ) ) + "," + ( l1d.getHits() / ( l1d.getHits() + l1d.getMisses() ) ) + "," + ( l2.getHits() + l2.getMisses() ) + "," + l2.getMisses() + "," + ( l2.getHits() / ( l2.getHits() + l2.getMisses() ) ) + "," + amatL2( l1d, l1i, l2, l1h, l2h, l2m ) );
}

function csv2( print, l1d, l1i, l2, l1h, l2h, l2m ) {
    print( l2.assoc + "," + ( l1i.getHits() + l1i.getMisses() ) + "," + l1i.getMisses() + "," + ( l1d.getHits() + l1d.getMisses() ) + "," + l1d.getMisses() + "," + ( l1i.getHits() / ( l1i.getHits() + l1i.getMisses() ) ) + "," + ( l1d.getHits() / ( l1d.getHits() + l1d.getMisses() ) ) + "," + ( l2.getHits() + l2.getMisses() ) + "," + l2.getMisses() + "," + ( l2.getHits() / ( l2.getHits() + l2.getMisses() ) ) + "," + amatL2( l1d, l1i, l2, l1h, l2h, l2m ) );
}

