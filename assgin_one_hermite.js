
import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

class Spline {
  // a lot of this will be with help from discussion
  //so the constructor first
  //consturctor wil help us keep track o the control points and the tangets at each of those points
  constructor()
  {
      this.points = []; 
      this.tangents = [];
      this.size = 0;
  }
  //now a function to delete everything
  reset() {
    this.points = []
    this.tangents=[];
    //now when we press circle, straight, reparse, or load, then we are strting fesh
  }
  num_control_points()
  {
    //getting the total number of control points
    return this.points.length;
  }
  add_point(x,y,z,tx,ty,tz)
  {
      this.points.push(vec3(x,y,z));
      this.tangents.push(vec3(tx,ty,tz));
      //self explanatory =, adding points to our lists
  }
  //i will also need one to set a point and set a tangent
  set_point(index,x,y,z)
  {
    this.check_index(index);
    this.points[index]=vec3(x,y,z);
  }
  set_tangent(index,tx,ty,tz)
  {
    this.check_index(index);
    this.tangents[index]=vec3(tx,ty,tz);

  }
  //setters are done 
  check_index(index)
  {
    //now i need to make sure my index is in range, avoiding issues in the fute
    if(!Number.isInteger(index) || index<0||index>=this.points.length)
      throw new Error('Index is out of range');
  }
  //now I have to evaluate postions at the global t and make sure it styas between 0 and 1
  eval(t)
  {
    const num_controls_points= this.num_control_points();
    if(num_controls_points===0) 
    {
      return vec3(0,0,0);
    }
    else if (num_controls_points===1) 
    {
      return this.points[0];
    }
    //now I hav e to do the clamping of the point, will use mah min and max functions
    const _t =Math.max(0,Math.min(1,t));
    //I need to also avoid segment overflow
    if(_t>=1)
      return this.points[num_controls_points-1];
    //control_points -1 for the number of hermite segs
    const segmentC = num_controls_points -1;
    //now i want to map the t to the seg inde and local param
    const scaled = _t * segmentC;
    const ind = Math.floor(scaled);
    const local_param = scaled -ind;
    //now going to eval the seg
    return this.evaluate_seg(ind,local_param);
  }

  evaluate_seg(ind,local_param)
  {
    //so now i have to eval the hermite seg ind at local_param in [0,1]
    const point0=this.points[ind];
    const point1=this.points[ind+1];
    //tangents --> dP/dt
    //hermite use dP/du 
    //dP/du = =dP/dt *dt
    //dt is going to be size of one seg in global param space 
    const dt = 1/(this.num_control_points()-1);
    const m0=this.tangents[ind].times(dt);
    const m1=this.tangents[ind+1].times(dt);
    //now for the next to value before doing hermite basis functions
    const u_square = local_param*local_param;
    const u_cube=u_square*local_param;
    //now the hermite basis functions
    const h1 = 2*u_cube-3*u_square+1;
    const h2 = u_cube-2*u_square+local_param;
    const h3 = -2*u_cube+3*u_square;
    const h4 = u_cube-u_square;
    //now the function is this p(u) = h1*point0+h2*m0+h3*point1+h4*m1
    return point0.times(h1).plus(m0.times(h2)).plus(point1.times(h3)).plus(m1.times(h4));
  }

  //now I have to sample the polyline
  sample_p(segmentSample = 30)
  {
    const numC=this.num_control_points();
    //same logic as earlier
    if (numC===0)
    {
      return [];
    }
    else if(numC===1)
    {
      return [this.points[0]];
    }
    const segmentC = numC-1;
    const out=[];
    //now a for loop 
    for (let segment = 0; segment<segmentC;segment++)
    {
      for (let z = 0;z<segmentSample;z++)
      {
        const u=z/segmentSample;
        out.push(this.evaluate_seg(segment,u));
      }
    }

    //we cannot forget the last endpoint
    out.push(this.points[numC-1]);
    return out;
  }

}

export
const Assign_one_hermite_base = defs.Assign_one_hermite_base =
    class Assign_one_hermite_base extends Component
    {                                          // **Assign_one_hermite_base** is a Scene that can be added to any display canvas.
                                               // This particular scene is broken up into two pieces for easier understanding.
                                               // The piece here is the base class, which sets up the machinery to draw a simple
                                               // scene demonstrating a few concepts.  A subclass of it, Assign_one_hermite,
                                               // exposes only the display() method, which actually places and draws the shapes,
                                               // isolating that code so it can be experimented with on its own.
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows() };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;
        this.spline = new Spline();
        this.spline.reset();
        this.spline.add_point(0, 1, 0,  1, 0, 0);
        this.spline.add_point(2, 1, 0,  1, 0, 0);
        const samples = this.spline.sample_p(30);
        this.spline_samples=[];
        console.log("num samples =", samples.length);
        console.log("first =", samples[0], "last =", samples[samples.length - 1]);

        console.log("eval(0)  =", this.spline.eval(0));
        console.log("eval(0.5)=", this.spline.eval(0.5));
        console.log("eval(1)  =", this.spline.eval(1));
      }

      render_animation( caller )
      {                                                
        // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Assign_one_hermite, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          Shader.assign_camera( Mat4.look_at (vec3 (10, 10, 10), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


export class Assign_one_hermite extends Assign_one_hermite_base
{                                                    // **Assign_one_hermite** is a Scene object that can be added to any display canvas.
                                                     // This particular scene is broken up into two pieces for easier understanding.
                                                     // See the other piece, My_Demo_Base, if you need to see the setup code.
                                                     // The piece here exposes only the display() method, which actually places and draws
                                                     // the shapes.  We isolate that code so it can be experimented with on its own.
                                                     // This gives you a very small code sandbox for editing a simple scene, and for
                                                     // experimenting with matrix transformations.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
        // From here on down it's just some example shapes drawn for you -- freely
        // replace them with your own!  Notice the usage of the Mat4 functions
        // translation(), scale(), and rotation() to generate matrices, and the
        // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // !!! Draw ball (for reference)
    let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
        .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

    // TODO: you should draw spline here.
  }

  render_controls()
  {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Assignment One:";
    this.new_line();
    this.key_triggered_button( "Parse Commands", [], this.parse_commands );
    this.new_line();
    this.key_triggered_button( "Draw", [], this.update_scene );
    this.new_line();
    this.key_triggered_button( "Load", [], this.load_spline );
    this.new_line();
    this.key_triggered_button( "Export", [], this.export_spline );
    this.new_line();

    /* Some code for your reference
    this.key_triggered_button( "Copy input", [ "c" ], function() {
      let text = document.getElementById("input").value;
      console.log(text);
      document.getElementById("output").value = text;
    } );
    this.new_line();
    this.key_triggered_button( "Relocate", [ "r" ], function() {
      let text = document.getElementById("input").value;
      const words = text.split(' ');
      if (words.length >= 3) {
        const x = parseFloat(words[0]);
        const y = parseFloat(words[1]);
        const z = parseFloat(words[2]);
        this.ball_location = vec3(x, y, z)
        document.getElementById("output").value = "success";
      }
      else {
        document.getElementById("output").value = "invalid input";
      }
    } );
     */
  }

  parse_commands() {
    document.getElementById("output").value = "parse_commands";
    //TODO
  }

  update_scene() { // callback for Draw button
    //so i first same the curve 
    this.spline_samples=this.spline.sample_p(30);
    //printing something so i know it actually ran
    document.getElementById("output").value = `drawn ${this.spline_samples.length} samples`;
  }

  load_spline() {
    document.getElementById("output").value = "load_spline";
    //TODO
  }

  export_spline() {
    document.getElementById("output").value = "export_spline";
    //TODO
  }
}
