const fs = require("fs");

//cache parent class
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
        print( "cache size: " + this.cacheSize );
        print( "block size: " + this.blockSize );
        print( "set associativity: " + this.assoc );
        print( "# blocks: " + this.blocks );
        print( "# sets: " + this.sets );
        print( "index bits: " + this.indexBits );
        print( "offset bits: " + this.offsetBits );
        print( "tag bits: " + this.tagBits);
    }

    hitInfo( print ) {
        print( "hits: " + this.hits);
        print( "misses: " + this.misses);
        print( "hit rate: " + this.hits / ( this.hits + this.misses ) );
    }

    addrInfo( address ) {
        console.log( toHex( address ) );
        var attr = this.split( address );
        console.log( toHex( attr[0] ) + " " + toHex( attr[1] ) + " " + toHex( attr[2] ) );
    }

    getIndex( address ) {
        if ( this.indexBits === 0 ) { return 0; } //fully associative case 
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

    dump( printRow, printCol ) {
        printRow( function() {
            printCol( "index" ); 
            printCol( "valid" );
            printCol( "tag" );
        });
        for ( var index = 0; index < this.sets; index++ ) {
            for ( var entry = 0; entry < this.assoc; entry++ ) {
                var valid = this.cache[index][entry][0];
                var tag = this.cache[index][entry][1];
                printRow( function() {
                    printCol( toHex( index ) );
                    printCol( valid );
                    printCol( toHex( tag ) );
                });
            }
        }
    }
}

//writethrough cache
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

//basic writeback cache. does not use an L2 cache but can be used as an L2 cache.
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

//Writeback cache that uses an L2 cache.
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

//read trace of memory references to a data and instruction cache
function read( file, dataCache, instructionCache ) {
    trace = fs.readFileSync( file );
    traceEntries = trace.toString().split("\n");
    traceEntries.forEach( function( entry ) {
        reference = entry.split(" ");
        address = ( parseInt(reference[1], 16) >>> 0 ); //bitshift to convert to 32 bit unsigned
        if ( reference[0] === "0" ) {
            dataCache.read( address );
        }
        else if ( reference[0] === "1" ) {
            dataCache.write( address );
        }
        else if ( reference[0] === "2" ) {
            instructionCache.read( address );
        }
        
    });

}

// helper functions
function toHex( address ) {
    return ( address ).toString(16);
}

// generate an instruction type
function generateType() {
    return Math.floor( Math.random() * 4 ) + 1;
}

// generate an address
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

//print function - currently outputs to stdout
print = function( output ) {
    console.log( output );
};

//drivers for parts
function part2( trace ) {
    print( trace );
    print( "Associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,AMAT");
    for ( var i = 0; i < 6; i++ ) {
        l1d = new WriteThrough( 1024, 32, Math.pow( 2, i ) );
        l1i = new WriteThrough( 1024, 32, Math.pow( 2, i ) );
        read( trace, l1d, l1i );
        csv( print, l1d, l1i, 1, 100 );
    }
}

function part4( trace ) {
    print( trace );
    print( "Associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,AMAT");
    for ( var i = 0; i < 6; i++ ) {
        l1d = new WriteBack( 1024, 32, Math.pow( 2, i ) );
        l1i = new WriteBack( 1024, 32, Math.pow( 2, i ) );
        read( trace, l1d, l1i );
        csv( print, l1d, l1i, 1, 100 );
    }
}

function part5( trace ) {
    print( "Part 5" );
    print( trace );
    print( "Associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 0; i < 10; i+=2 ) {
        as = Math.pow( 2, i );
        if ( as > 128 ) { as = 128; }
        l2 = new WriteBack( 16384, 128, as );
        l1d = new WriteBackL1( 1024, 32, 2, l2 );
        l1i = new WriteBackL1( 1024, 32, 2, l2 );
        read( trace, l1d, l1i );
        csv2( print, l1d, l1i, l2, 1, 10, 100 );
    }
}

function part6() {
    print( "Part 6" );
    print( "L2 block size (L2 size 16384, L1 size 1024, 32 byte blocks, set assoc 2 for both)" );
    print( "L2 block size,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 2; i < 10; i++ ) {
        l2 = new WriteBack( 16384, Math.pow(2, i), 2 );
        l1d = new WriteBackL1( 1024, 32, 2, l2 );
        l1i = new WriteBackL1( 1024, 32, 2, l2 );
        read( "cc.trace", l1d, l1i );
        csv3( print, l1d, l1i, l2, 1, 10, 100, Math.pow(2, i) );
    }
    print( "L2 associativity (L2 size 16384, 128 byte blocks, L1 size 1024, L1 32 byte blocks, L1 2 way associative)" );
    print( "L2 associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 0; i < 6; i++ ) {
        l2 = new WriteBack( 16384, 128, Math.pow(2, i) );
        l1d = new WriteBackL1( 1024, 32, 2, l2 );
        l1i = new WriteBackL1( 1024, 32, 2, l2 );
        read( "cc.trace", l1d, l1i );
        csv3( print, l1d, l1i, l2, 1, 10, 100, Math.pow(2, i) );
    }
    print( "L1 associativity (L2 size 16384, 128 byte blocks, 2 way assoc, L1 size 1024, L1 32 byte blocks)" );
    print( "L1 associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 0; i < 6; i++ ) {
        l2 = new WriteBack( 16384, 128, 2 );
        l1d = new WriteBackL1( 1024, 32, Math.pow(2, i), l2 );
        l1i = new WriteBackL1( 1024, 32, Math.pow(2, i), l2 );
        read( "cc.trace", l1d, l1i );
        csv3( print, l1d, l1i, l2, 1, 10, 100, Math.pow(2, i) );
    }
    print( "L1 block size (L2 size 16384, 128 byte blocks, L1 size 1024, set assoc 2 for both)" );
    print( "L1 block size,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 2; i < 8; i++ ) {
        l2 = new WriteBack( 16384, 128, 2 );
        l1d = new WriteBackL1( 1024, Math.pow(2, i), 2, l2 );
        l1i = new WriteBackL1( 1024, Math.pow(2, i), 2, l2 );
        read( "cc.trace", l1d, l1i );
        csv3( print, l1d, l1i, l2, 1, 10, 100, Math.pow(2, i) );
    }
    print( "L1 cache size (L2 size 16384, 128 byte blocks, L1 32 byte blocks, set assoc 2)" );
    print( "L1 cache size,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    for ( var i = 8; i < 14; i++ ) {
        l2 = new WriteBack( 16384, 128, 2 );
        l1d = new WriteBackL1( Math.pow(2, i), 32, 2, l2 );
        l1i = new WriteBackL1( Math.pow(2, i), 32, 2, l2 );
        read( "cc.trace", l1d, l1i );
        csv3( print, l1d, l1i, l2, 1, 10, 100, Math.pow(2, i) );
    }
}

function part8() {
    print( "test1/2/3 writethrough" );
    l1d = new WriteThrough( 1024, 16, 4 );
    l1i = new WriteThrough( 1024, 16, 4 );
    read( "test1.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    l1d = new WriteThrough( 1024, 16, 4 );
    l1i = new WriteThrough( 1024, 16, 4 );
    read( "test2.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    l1d = new WriteThrough( 1024, 16, 4 );
    l1i = new WriteThrough( 1024, 16, 4 );
    read( "test3.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    print( "test1/2/3 writeback" );
    l1d = new WriteBack( 1024, 16, 4 );
    l1i = new WriteBack( 1024, 16, 4 );
    read( "test1.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    l1d = new WriteBack( 1024, 16, 4 );
    l1i = new WriteBack( 1024, 16, 4 );
    read( "test2.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    l1d = new WriteBack( 1024, 16, 4 );
    l1i = new WriteBack( 1024, 16, 4 );
    read( "test3.trace", l1d, l1i);
    csv( print, l1d, l1i, 1, 100 );
    print( "test4" );
    l2 = new WriteBack( 8192, 128, 4 );
    l2.info (print);
    l1d = new WriteBackL1( 1024, 16, 4, l2 );
    l1i = new WriteBackL1( 1024, 16, 4, l2 );
    read( "test4.trace", l1d, l1i );
    print( "Associativity,L1I accesses,L1I misses,L1D accesses,L1D misses,L1I hit rate,L1D hit rate,L2 accesses,L2 misses, L2 hit rate,AMAT");
    csv2( print, l1d, l1i, l2, 1, 10, 100 );
}


