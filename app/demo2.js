// define(['./cg', './ui'],
//   function(cg, ui) {
import input from 'boredjs/input'
import audio from 'boredjs/audio'
import util from 'boredjs/util'
import game from 'boredjs/game'
import geometry from 'boredjs/geometry'
import entity from 'boredjs/entity'
import physics from 'boredjs/physics'
import map from 'boredjs/map'

    let fadeIn = function(duration, callback) {
        let t_accum = 0.0;
        let updateGenerator = function*() {
            while (t_accum < duration) {
                let dt = yield undefined;
                t_accum += dt;
            }
            if (callback != null) { return callback(); }
        };
        let drawGenerator = function*() {
            return yield* (function*() { let result = []; while (t_accum < duration) {
                let context = yield undefined;
                let alpha = 1.0 - (Math.min(t_accum / duration, 1.0));
                context.fillStyle = `rgba(0,0,0,${alpha})`;
                result.push(context.fillRect(0, 0, game.width(), game.height()));
            } return result; }).call(this);
        };

        return util.prepareCoroutineSet(updateGenerator, drawGenerator);
    };

    class DemoScene extends map.MapScene {
        start() {
            super.start();
            game.state = 'fx';
            return game.invoke(fadeIn(0.5, () => game.state = 'world'));
        }
    }

    class Character extends entity.Entity {
        constructor(x, y, shape, sprite) {
            super(x, y, shape);
            this.sprite = sprite;
            this.sprite.startAnimation('look down');
        }

        draw(context, offx, offy) {
            this.sprite.draw(context, this.x + offx, this.y + offy, this.facing_left);
            return;
        }
    }

    class PlayerCharacter extends Character {
        constructor(x, y, shape, sprite) {
            super(x, y, shape, sprite);
            this.dir = 'down';
            this.state = `look ${this.dir}`;
            let map = game.currentScene().map;
            let player = this;
            let ent_layer = map.getLayerByName('Entities');

            this.activation_point_check = new entity.Entity(x, y + 2 * this.shape.bounds_offsets[3], new geometry.Point());
            this.activation_point_check.collides = util.constructBitmask([0]);
            this.activation_point_check.onCollide = function(ent, info) {
                if (game.state === 'world' && input.jump.pressed) {
                    if (!(ent.onActivate != null) && (ent.properties != null)) {
                        ent.onActivate = map.tryGettingCallbackForName(ent.properties.onActivate);
                    }
                    player.sprite.startAnimation(`look ${player.dir}`);
                    ent.onActivate(ent);
                }
                return;
            };
            ent_layer.addEntity(this.activation_point_check);
            
            map.camera.post_update = function(dt) {
                this.x = player.x;
                this.y = player.y;
                return;
            };
        }

        update(dt) {
            let { sprite } = this;
            let { state } = this;
            let switchStateTo = function(name) {
                if (state !== name) {
                    sprite.startAnimation(name);
                    state = name;
                }
                return;
            };

            if (game.state === 'world') {
                let vxc = 0.0;
                let vyc = 0.0;

                if (input.left.state && !input.right.state) {
                    vxc = -1.0;
                } else if (input.right.state && !input.left.state) {
                    vxc = 1.0;
                }

                if (input.up.state && !input.down.state) {
                    vyc = -1.0;
                } else if (input.down.state && !input.up.state) {
                    vyc = 1.0;
                }

                if (vxc < 0.0) {
                    if (vyc < 0.0) {
                        this.dir = 'up-left';
                    } else if (vyc > 0.0) {
                        this.dir = 'down-left';
                    } else {
                        this.dir = 'left';
                    }
                } else if (vxc > 0.0) {
                    if (vyc < 0.0) {
                        this.dir = 'up-right';
                    } else if (vyc > 0.0) {
                        this.dir = 'down-right';
                    } else {
                        this.dir = 'right';
                    }
                } else {
                    if (vyc < 0.0) {
                        this.dir = 'up';
                    } else if (vyc > 0.0) {
                        this.dir = 'down';
                    }
                }

                if (vyc === 0.0 && vxc === 0.0) {
                    switchStateTo(`look ${this.dir}`);
                } else {
                    switchStateTo(`go ${this.dir}`);
                }

                this.state = state;
                let inv_spd_c = vxc === 0.0 && vyc === 0.0 ? 1.0 : 1.0/Math.sqrt(vxc*vxc+vyc*vyc);
                this.velocity = [48.0 * vxc * inv_spd_c, 48.0 * vyc * inv_spd_c];
                physics.integrate(this, dt);

                if (this.dir === 'left') {
                    this.activation_point_check.x = this.x + 2 * this.shape.bounds_offsets[0];
                    this.activation_point_check.y = this.y;
                } else if (this.dir === 'right') {
                    this.activation_point_check.x = this.x + 2 * this.shape.bounds_offsets[1];
                    this.activation_point_check.y = this.y;
                } else if (this.dir === 'up') {
                    this.activation_point_check.x = this.x;
                    this.activation_point_check.y = this.y + 2 * this.shape.bounds_offsets[2];
                } else if (this.dir === 'down') {
                    this.activation_point_check.x = this.x;
                    this.activation_point_check.y = this.y + 2 * this.shape.bounds_offsets[3];
                } else if (this.dir === 'up-left') {
                    this.activation_point_check.x = this.x + Math.sqrt(2) * this.shape.bounds_offsets[0];
                    this.activation_point_check.y = this.y + Math.sqrt(2) * this.shape.bounds_offsets[2];
                } else if (this.dir === 'up-right') {
                    this.activation_point_check.x = this.x + Math.sqrt(2) * this.shape.bounds_offsets[1];
                    this.activation_point_check.y = this.y + Math.sqrt(2) * this.shape.bounds_offsets[2];
                } else if (this.dir === 'down-left') {
                    this.activation_point_check.x = this.x + Math.sqrt(2) * this.shape.bounds_offsets[0];
                    this.activation_point_check.y = this.y + Math.sqrt(2) * this.shape.bounds_offsets[3];
                } else if (this.dir === 'down-right') {
                    this.activation_point_check.x = this.x + Math.sqrt(2) * this.shape.bounds_offsets[1];
                    this.activation_point_check.y = this.y + Math.sqrt(2) * this.shape.bounds_offsets[3];
                }
            }

            sprite.update(dt);
            return;
        }
    }

    let player = null;
    let player_shape = null;
    let player_sprite = null;

    export default {
        setPlayerMetadata(shape, sprite) {
            player_shape = shape;
            player_sprite = sprite;
            return;
        },

        handlePlayerStart(obj) {
            player = new PlayerCharacter(obj.x, obj.y, player_shape, player_sprite, obj.map.camera);
            player.obstructs = util.constructBitmask([0]);
            obj.layer.addEntity(player);
            return;
        },

        handleChest1Start(obj) {
            return;
        },

        tryOpeningChest1(obj) {
            let tx = (obj.x / obj.map.tilewidth) | 0;
            let ty = (obj.y / obj.map.tileheight) | 0;
            let layer = obj.map.getLayerByName('Ground');
            let td = layer.data[tx][ty].slice();
            td[0]++;
            layer.setTile(tx, ty, td);
            ui.textBoxDialog('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 0, 0, 160, 44, 10.0, null, null, () => game.state = 'world');
            return;
        },

        DemoScene
    };
// });
