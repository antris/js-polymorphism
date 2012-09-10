(function() {
    var bilby;

    function findRegistered(registrations, args) {
        var i;
    
        for(i = 0; i < registrations.length; i++) {
            if(registrations[i].predicate.apply(this, args))
                return registrations[i].f;
        }
    
        throw new Error("Method not implemented for this input");
    }
    
    function makeMethod(registrations) {
        return function() {
            var args = [].slice.call(arguments);
            return findRegistered(registrations, args).apply(this, args);
        };
    }
    
    function environment(methods, properties) {
        var i;
    
        if(!(this instanceof environment) || (typeof this.method != 'undefined' && typeof this.property != 'undefined'))
            return new environment(methods, properties);
    
        methods = methods || {};
        properties = properties || {};
    
        for(i in methods) {
            this[i] = makeMethod(methods[i]);
        }
    
        for(i in properties) {
            this[i] = properties[i];
        }
    
        this.method = curry(function(name, predicate, f) {
            var newMethods = extend(methods, singleton(name, (methods[name] || []).concat({
                predicate: predicate,
                f: f
            })));
            return environment(newMethods, properties);
        });
    
        this.property = curry(function(name, value) {
            var newProperties = extend(properties, singleton(name, value));
            return environment(methods, newProperties);
        });
    }
    

    bilby = environment();
    bilby = bilby.property('environment', environment);

    function bind(f) {
        return function(o) {
            if(f.bind)
                return f.bind.apply(f, [o].concat([].slice.call(arguments, 1)));
    
            var length = f._length || f.length,
                args = [].slice.call(arguments, 1),
                g = function() {
                    return f.apply(o || this, args.concat([].slice.call(arguments)));
                };
    
            // Can't override length but can set _length for currying
            g._length = length - args.length;
    
            return g;
        };
    }
    
    function curry(f) {
        return function() {
            var g = bind(f).apply(f, [this].concat([].slice.call(arguments))),
                // Special hack for polyfilled Function.prototype.bind
                length = g._length || g.length;
    
            if(length === 0)
                return g();
    
            return curry(g);
        };
    }
    
    function error(s) {
        return function() {
            throw new Error(s);
        };
    }
    
    function identity(o) {
        return o;
    }
    
    function constant(c) {
        return function() {
            return c;
        };
    }
    
    function zip(a, b) {
        var accum = [],
            i;
        for(i = 0; i < Math.min(a.length, b.length); i++) {
            accum.push([a[i], b[i]]);
        }
    
        return accum;
    }
    
    // TODO: Make into an Option semigroup#append
    function extend(a, b) {
        var o = {},
            i;
    
        for(i in a) {
            o[i] = a[i];
        }
        for(i in b) {
            o[i] = b[i];
        }
    
        return o;
    }
    
    function singleton(k, v) {
        var o = {};
        o[k] = v;
        return o;
    }
    
    var isTypeOf = curry(function(s, o) {
        return typeof o == s;
    });
    var isFunction = isTypeOf('function');
    var isString = isTypeOf('string');
    var isNumber = isTypeOf('number');
    function isArray(a) {
        if(Array.isArray) return Array.isArray(a);
        return Object.prototype.toString.call(a) === "[object Array]";
    }
    var isInstanceOf = curry(function(c, o) {
        return o instanceof c;
    });
    
    bilby = bilby
        .property('bind', bind)
        .property('curry', curry)
        .property('error', error)
        .property('identity', identity)
        .property('constant', constant)
        .property('zip', zip)
        .property('extend', extend)
        .property('singleton', singleton)
        .property('isTypeOf',  isTypeOf)
        .property('isFunction', isFunction)
        .property('isString', isString)
        .property('isNumber', isNumber)
        .property('isArray', isArray)
        .property('isInstanceOf', isInstanceOf);
    

    // Gross mutable global
    var doQueue;
    
    // Boilerplate
    function Do() {
        if(arguments.length)
            throw new TypeError("Arguments given to Do. Proper usage: Do()(arguments)");
    
        var env = this,
            oldDoQueue = doQueue;
    
        doQueue = [];
        return function(n) {
            var op, x, i;
            if(!doQueue.length) {
                doQueue = oldDoQueue;
                return n;
            }
    
            if(n === true) op = '>=';
            if(n === false) op = '<';
            if(n === 0) op = '>>';
            if(n === 1) op = '*';
            if(n === doQueue.length) op = '+';
    
            if(!op) {
                doQueue = oldDoQueue;
                throw new Error("Couldn't determine Do operation. Could be ambiguous.");
            }
    
            x = doQueue[0];
            for(i = 1; i < doQueue.length; i++) {
                x = env[op](x, doQueue[i]);
            }
    
            doQueue = oldDoQueue;
            return x;
        };
    }
    Do.setValueOf = function(proto) {
        var oldValueOf = proto.valueOf;
        proto.valueOf = function() {
            if(doQueue === undefined)
                return oldValueOf.call(this);
    
            doQueue.push(this);
            return 1;
        };
    };
    
    bilby = bilby.property('Do', Do);
    

    // Option
    function some(x) {
        if(!(this instanceof some)) return new some(x);
        this.getOrElse = function() {
            return x;
        };
        this.toLeft = function() {
            return left(x);
        };
        this.toRight = function() {
            return right(x);
        };
    
        this.bind = function(f) {
            return f(x);
        };
        this.map = function(f) {
            return some(f(x));
        };
        this.apply = function(s) {
            return s.map(x);
        };
        this.append = function(s, plus) {
            return s.map(function(y) {
                return plus(x, y);
            });
        };
        Do.setValueOf(this);
    }
    
    var none = {
        getOrElse: function(x) {
            return x;
        },
        toLeft: function(r) {
            return right(r);
        },
        toRight: function(l) {
            return left(l);
        },
    
        bind: function() {
            return this;
        },
        map: function() {
            return this;
        },
        apply: function() {
            return this;
        },
        append: function() {
            return this;
        }
    };
    Do.setValueOf(none);
    
    function isOption(x) {
        return isInstanceOf(some, x) || x === none;
    }
    
    // Either (right biased)
    function left(x) {
        if(!(this instanceof left)) return new left(x);
        this.fold = function(a, b) {
            return a(x);
        };
        this.swap = function() {
            return right(x);
        };
        this.isLeft = true;
        this.isRight = false;
        this.toOption = function() {
            return none;
        };
        this.toArray = function() {
            return [];
        };
    
        this.bind = function() {
            return this;
        };
        this.map = function() {
            return this;
        };
        this.apply = function(e) {
            return this;
        };
        this.append = function(l, plus) {
            var t = this;
            return l.fold(function(y) {
                return left(plus(x, y));
            }, function() {
                return t;
            });
        };
    }
    
    function right(x) {
        if(!(this instanceof right)) return new right(x);
        this.fold = function(a, b) {
            return b(x);
        };
        this.swap = function() {
            return left(x);
        };
        this.isLeft = false;
        this.isRight = true;
        this.toOption = function() {
            return some(x);
        };
        this.toArray = function() {
            return [x];
        };
    
        this.bind = function(f) {
            return f(x);
        };
        this.map = function(f) {
            return right(f(x));
        };
        this.apply = function(e) {
            return e.map(x);
        };
        this.append = function(r, plus) {
            return r.fold(function(x) {
                return left(x);
            }, function(y) {
                return right(plus(x, y));
            });
        };
    }
    
    function isEither(x) {
        return isInstanceOf(left, x) || isInstanceOf(right, x);
    }
    
    
    bilby = bilby
        .property('some', some)
        .property('none', none)
        .property('isOption', isOption)
        .method('>=', isOption, function(a, b) {
            return a.bind(b);
        })
        .method('<', isOption, function(a, b) {
            return a.map(b);
        })
        .method('*', isOption, function(a, b) {
            return a.apply(b);
        })
        .method('+', isOption, function(a, b) {
            return a.append(b, this['+']);
        })
    
        .property('left', left)
        .property('right', right)
        .property('isEither', isEither)
        .method('>=', isEither, function(a, b) {
            return a.bind(b);
        })
        .method('<', isEither, function(a, b) {
            return a.map(b);
        })
        .method('*', isEither, function(a, b) {
            return a.apply(b);
        })
        .method('+', isEither, function(a, b) {
            return a.append(b, this['+']);
        });
    

    bilby = bilby
        .method('equal', isNumber, function(a, b) {
            return a == b;
        })
        .method('equal', isString, function(a, b) {
            return a == b;
        })
        .method('equal', isArray, function(a, b) {
            var env = this;
            return env.fold(zip(a, b), true, function(a, t) {
                return a && env.equal(t[0], t[1]);
            });
        })
    
        .method('fold', isArray, function(a, b, c) {
            var i;
            for(i = 0; i < a.length; i++) {
                b = c(b, a[i]);
            }
            return b;
        })
    
        .method('>=', isArray, function(a, b) {
            var accum = [],
                i;
    
            for(i = 0; i < a.length; i++) {
                accum = accum.concat(b(a[i]));
            }
    
            return accum;
        })
        .method('<', isArray, function(a, b) {
            var accum = [],
                i;
    
            for(i = 0; i < this.length; i++) {
                accum[i] = b(this[i]);
            }
    
            return accum;
        })
        .method('*', isArray, function(a, b) {
            var accum = [],
                i,
                j;
    
            for(i = 0; i < a.length; i++) {
                for(j = 0; j < b.length; j++) {
                    accum.push(a[i](b[j]));
                }
            }
    
            return accum;
        })
        .method('+', isArray, function(a, b) {
            return a.concat(b);
        })
    
        .method('+', isNumber, function(a, b) {
            return a + b;
        })
        .method('+', isString, function(a, b) {
            return a + b;
        })
        .method('>>', isFunction, function(a, b) {
            var env = this;
            return function(x) {
                return env['>='](a(x), b);
            };
        });
    
    Do.setValueOf(Array.prototype);
    Do.setValueOf(Function.prototype);
    

    if(typeof exports != 'undefined') {
        exports = module.exports = bilby;
    } else {
        this.bilby = bilby;
    }
})(this);