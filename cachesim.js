// Parent cache class
class Cache {
    constructor( cacheSize, blockSize, assoc ) {
        this.cacheSize = cacheSize;
        this.blockSize = blockSize;
        this.assoc = assoc;

        this.blocks = cacheSize / blockSize;
        this.sets = this.blocks / assoc;
        this.indexBits = Math.log2( this.sets );
        this.offsetBits = Math.log2( blockSize );
        this.tagBits = 32 - this.indexBits - this.offsetBits;

        this.cache = new Array( this.sets );
        for ( var index = 0; index < this.sets; index++ ) {
            this.cache[index] = new Array( this.assoc );
            for (var entry = 0; entry < this.assoc; entry++ ) {
                this.cache[index][entry] = new Array( 3 ).fill(0);
            }
        }

        this.hits = 0;
        this.misses = 0;
    }
    
    getHits() { return this.hits; }
    getMisses() { return this.misses; }

    info( print ) {
        print( "Cache size: " + this.cacheSize );
        print( "Block size: " + this.blockSize );
        print( "# Blocks: " + this.blocks );
        print( "Set associativity: " + this.assoc );
        print( "# Sets: " + this.sets );
        print( "Index bits: " + this.indexBits );
        print( "Offset bits: " + this.offsetBits );
        print( "Tag bits: " + this.tagBits);
    }

    hitInfo( print ) {
        print( "Hits: " + this.hits);
        print( "Misses: " + this.misses);
        print( "Hit rate: " + this.hits / ( this.hits + this.misses ) );
    }

    addrInfo( address ) {
        console.log( toHex( address ) );
        var attr = this.split( address );
        console.log( toHex( attr[0] ) + " " + toHex( attr[1] ) + " " + toHex( attr[2] ) );
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

    display( makeRow ) {
        makeRow( function( makeCol ) {
            return (
                makeCol( "index" ) +
                makeCol( "valid" ) +
                makeCol( "tag" )
            );
        });
        for ( var index = 0; index < this.sets; index++ ) {
            for ( var entry = 0; entry < this.assoc; entry++ ) {
                var valid = this.cache[index][entry][0];
                var tag = this.cache[index][entry][1];
                makeRow( function( makeCol ) {
                    return (
                        makeCol( toHex( index ) ) +
                        makeCol( valid ) +
                        makeCol( toHex( tag ) )
                    );
                });
            }
        }
    }
}

// Writethrough cache
class WriteThrough extends Cache {
    write( address ) {
        var attr = this.split( address );
        var entry
        var hit = function( cache, entry ) {
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

