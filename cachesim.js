class CacheEntry {
    constructor( valid=0, tag=0 ) {
        this.valid = valid;
        this.tag = tag;
    }

    display( displayField ) {
        return (
            displayField( valid ) +
            displayField( toHex( tag ) )
        );
    }
}

CacheEntry.displayLabels = function( displayField ) {
    return (
        displayField( 'valid' ) +
        displayField( 'tag' )
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

    display( displayField ) {
        return (
            super.display( displayField ) +
            displayField( toHex( lru ) )
        );
    }
}

LRUCacheEntry.displayLabels = function(displayField ) {
    return (
        super.displayLabels( displayField ) +
        displayField( 'lru' )
    );
}

class dirtyBitLRUCacheEntry extends LRUCacheEntry{
    constructor( valid=0, tag=0, lru=0, dirty=0 ) {
        super( valid, tag );
        this.lru = lru;
        this.dirty = dirty;
    }

    display( displayField ) {
        return (
            super.display( displayField ) +
            displayField( toHex( dirty ) )
        );
    }
}

dirtyBitLRUCacheEntry.displayLabels = function( displayField ) {
    return (
        super.displayLabels( displayField ) +
        displayField( 'dirty' )
    );
}

class Cache {
    constructor( cacheSize, blockSize, setSize, cacheEntry, next=null ) {
        if ( !isPower2( cacheSize ) ) { throw "Cache size must be power of 2"; }
        if ( !isPower2( blockSize ) ) { throw "Block size must be power of 2"; }
        if ( !isPower2( associativity ) ) { throw "Set associativity must be power of 2"; }

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
    
    getHits() { return this.hits; }
    getMisses() { return this.misses; }

    info( displayInfo ) {
        return ( 
            displayInfo( "Cache size: " + this.cacheSize ) +
            displayInfo( "Block size: " + this.blockSize ) +
            displayInfo( "# Blocks: " + this.blocks ) +
            displayInfo( "Set associativity: " + this.setSize ) +
            displayInfo( "# Sets: " + this.sets ) +
            displayInfo( "Index bits: " + this.indexBits ) +
            displayInfo( "Offset bits: " + this.offsetBits ) +
            displayInfo( "Tag bits: " + this.tagBits )
        );
    }

    hitInfo( displayInfo ) {
        return (
            displayInfo( "Hits: " + this.hits )
            displayInfo( "Misses: " + this.misses )
            displayInfo( "Hit rate: " + this.hits / ( this.hits + this.misses ) )
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
        var tag = this.getTag( address );
        var index = this.getIndex( address );
        var offset = this.getOffset( address );
        return [ tag, index, offset ];
    }

    display( displayRow, displayCol ) {
        entries = displayRow(
            displayCol( 'set' ) +
            this.entry.displayNames( displayCol ) 
        );
        for ( var set = 0; set < this.sets; set++ ) {
            for ( var id = 0; id < this.setSize; id++ ) {
                entries += displayRow(
                    displayCol( toHex( set ) ) +
                    this.entry.displayNames( displayCol )
                );
            }
        }
    }

    readHit( set, tag, id ) { }
    readMiss( set, tag, id ) { }
    writeHit( set, tag, id ) { }
    writeMiss( set, tag, id ) { }

    locate( set, tag ) {
        for ( var id = 0; id < this.assoc; id++ ) {
            if ( this.cache[set][id].valid == 1 && this.cache[set][id].tag == tag ) {
                return id;
            }
        }
        return null;
    }

    write( set, tag ) {
        var id = locate( set, tag );
        if ( id !== null ) {
            this.cache.hits++;
            writeHit( set, tag, id );
        }
        else { 
            this.cache.misses++;
            writeMiss( set, tag, id );
        }
    }
    
    writeAddress( address ) {
        var attr = this.split( address );
        var tag = attr[0];
        var set = attr[1];
        write( set, tag );
    }

    read( set, tag ) {
        var id = locate( set, tag );
        if ( id !== null ) {
            this.cache.hits++;
            readHit( set, tag, id );
        }
        else { 
            this.cache.misses++;
            readMiss( set, tag, id );
        }
    }
    
    readAddress( address ) {
        var attr = this.split( address );
        var tag = attr[0];
        var set = attr[1];
        read( set, tag );
    }
}

class LRUCache extends Cache {
    getLRUId( set ) {
        var lruId = 0;
        for ( var entryId = 0; entryId < setSize; entryId++ ) {
            if ( this.cache[set][replaceId].lru < this.cache[set][replaceId].lru ) {
                replaceId = id;
            }
        }
        return replaceId;
    }

    replaceLRU( set, tag ) {
        var id = getLRUid( set );
        var replaced = this.cache[set][id];
        this.cache[set][id] = new LRUCacheEntry( 1, tag, 0 );
        return replaced;
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
        use( set, tag, id );
        if ( this.next ) { this.next.write( set, tag ); }
    }

    writeMiss( set, tag, id ) {
        if ( this.next ) { this.next.write( set, tag );
    }
    
    readHit( set, tag, id ) {
        use( set, tag, id );
    }

    readMiss( set, tag, id ) {
        replaceLRU( set, tag );
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

    replaceLRU( set, tag ) { 
        replaced = super.replaceLRU( set, tag );
        if ( replaced.dirty = 1 ) {
            next.write( set, tag )

    writeHit( set, tag, id ) {
        use( set, tag, id );
        this.cache[set][id].dirty = 1;
    }

    writeMiss( set, tag, id ) {
        replaced = replaceLRU( set, tag );
        if ( this.next ) { 
            this.next.write( set, tag ); 
        }
    }
    
    readHit( set, tag, id ) {
        use( set, tag, id );
    }

    readMiss( set, tag, id ) {
        replaceLRU( set, tag );
        if ( this.next ) { 
            this.next.read( set, tag ); 
        }
    }
}



        ( var id = 0; entry < this.assoc; entry++ ) {
            if ( this.cache[index][entry][0] ) {
                this.cache[index][entry][3]++;
            }
        }

        this.cache[index][id][0] = 1
        this.cache[index][id][1] = tag
        this.cache[index

            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], data[0][2] ] );
            cache.misses++;
        }
        var miss = function( cache, entry ) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 0 ] );
            cache.cache[attr[1]].pop();
            cache.misses++;
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry );
    }

    read( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], data[0][2] ] );
            cache.hits++;
        }
        var miss = function( cache, entry ) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 0 ] );
            cache.cache[attr[1]].pop();
            cache.misses++;
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry );
    }
}

// Basic writeback cache - does not use an L2 cache but can be used as an L2 cache
class WriteBack extends Cache {
    write( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], 1 ] );
            cache.hits++;
        }
        var miss = function( cache, entry ) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 1 ] );
            if ( cache.cache[attr[1]].pop()[2] === 0 ) { //clean
                cache.hits++;
            }
            else { //dirty
                cache.misses++;
            }
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry );
    }

    read( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], data[0][2] ] );
            cache.hits++;
        }
        var miss = function( cache, entry ) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 0 ] );
            cache.cache[attr[1]].pop();
            cache.misses++;
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry );
    }
}

// Writeback cache that uses an L2 cache.
class WriteBackL1 extends Cache {
    constructor( cacheSize, blockSize, assoc, L2 ) {
        super( cacheSize, blockSize, assoc );
        this.L2 = L2;
    }

    write( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], 1 ] );
            cache.hits++;
        }
        var miss = function( cache, entry ) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 1 ] );
            if ( cache.cache[attr[1]].pop()[2] === 0 ) { //clean
                cache.hits++;
            }
            else { //dirty
                cache.misses++;
                cache.L2.write( address );
            }
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry, this.L2 );
    }

    read( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
            var data = cache.cache[attr[1]].splice( entry, 1 );
            cache.cache[attr[1]].unshift( [ data[0][0], data[0][1], data[0][2] ] );
            cache.hits++;
        }
        var miss = function( cache, entry) {
            cache.cache[attr[1]].unshift( [ 1, attr[0], 0 ] );
            cache.cache[attr[1]].pop();
            cache.misses++;
            cache.L2.read( address );
        }
        var result = miss; //assume miss
        for ( entry = 0; entry < this.assoc; entry++ ) {
            var valid = this.cache[attr[1]][entry][0] 
            var tag = this.cache[attr[1]][entry][1]
            if ( valid == 1 && tag == attr[0] ) {
                result = hit;
                break;
            }
        }
        result( this, entry, this.L2 );
    }
}

                        
function isPower2( value ) {
    return value && !( value & ( value - 1 ) );
}

// Run a single instruction
function runInstruction( type, addressHex, dataCache, instructionCache ) {
    if ( type === "0" ) {
        dataCache.read( address );
    }
    else if ( type === "1" ) {
        dataCache.write( address );
    }
    else if ( type === "2" ) {
        instructionCache.read( address );
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

   

// Convert an unsigned address to hex
function toHex( address ) {
    return ( address ).toString( 16 );
}

// Convert a hex address to 32 bit unsigned
function toUnsigned( addressHex ) {
        return ( parseInt( addressHex, 16 ) >>> 0 );
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

