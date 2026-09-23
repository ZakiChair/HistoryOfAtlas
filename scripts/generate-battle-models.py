"""Author the HistoryOfAtlas battle miniatures in an isolated Blender process.

Run: blender --background --factory-startup --python scripts/generate-battle-models.py -- --all
No downloaded meshes/textures or live Blender scene are used. World units are metres.
Source equipment constraints are documented separately in docs/battle-units.md.
"""
import argparse
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/models/battles'
TAU = math.tau
M = {}


def material(name, colour, metallic=0, roughness=.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*colour, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*colour, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in [bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.actions]:
        for value in list(collection):
            if value.users == 0:
                collection.remove(value)
    M.clear()
    palette = {
        'skin': ((.49,.29,.18),0,.82), 'cloth': ((.56,.47,.32),0,.94),
        'cloth_dark': ((.23,.25,.23),0,.93), 'linen': ((.72,.66,.50),0,.92),
        'leather': ((.17,.10,.052),0,.88), 'wood': ((.30,.16,.065),0,.83),
        'wood_light': ((.46,.28,.12),0,.85), 'bronze': ((.51,.32,.105),.72,.38),
        'iron': ((.25,.29,.29),.72,.43), 'steel': ((.43,.49,.49),.8,.34),
        'edge': ((.66,.70,.66),.7,.34), 'dark_metal': ((.09,.11,.105),.55,.5),
        'rose': ((.53,.20,.25),0,.9), 'red': ((.42,.08,.045),0,.9), 'blue': ((.065,.15,.23),0,.9),
        'olive': ((.24,.28,.14),0,.92), 'black': ((.032,.036,.031),.05,.85),
        'eye': ((.055,.041,.027),0,.7), 'horse': ((.22,.12,.062),0,.84),
        'mane': ((.052,.035,.018),0,.97), 'white': ((.77,.75,.63),0,.9),
        'waterline': ((.34,.12,.065),0,.82),
        'japanese_navy': ((.021,.028,.045),0,.92),
        'cap_yellow': ((.66,.46,.08),0,.88),
        'russian_greatcoat': ((.31,.29,.25),0,.97),
        'russian_felt': ((.17,.16,.14),0,.99),
        'winter_drab': ((.36,.30,.22),0,.97),
        'french_capote': ((.22,.29,.34),0,.97),
        'garance': ((.43,.044,.038),0,.94),
        'prussian_blue': ((.045,.09,.17),0,.94),
        'prussian_grey': ((.25,.265,.27),0,.94),
    }
    for name, args in palette.items():
        M[name] = material(name, *args)
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 30


def parent(obj, par):
    if par:
        world = obj.matrix_world.copy()
        obj.parent = par
        obj.matrix_world = world
    return obj


def finish(obj, name, mat, par=None, smooth=True):
    obj.name = name
    if mat:
        obj.data.materials.append(M[mat])
    if smooth and obj.type == 'MESH':
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    bpy.context.view_layer.update()
    return parent(obj, par)


def pivot(name, pos=(0,0,0), par=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    bpy.context.view_layer.update()
    return parent(obj, par)


def sphere(name, pos, scale, mat, par=None, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, par)


def box(name, pos, scale, mat, par=None, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('crafted_edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat, par, smooth=False)


def cylinder(name, a, b, radius, mat, par=None, vertices=12, radius2=None):
    a, b = Vector(a), Vector(b)
    delta = b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2, depth=delta.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, name, mat, par)


def tube(name, points, radius, mat, par=None, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.resolution_u = 8
    curve.bevel_resolution = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, coordinate in zip(spline.points, points):
        p.co = (*coordinate, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, mat, par)


def mesh(name, verts, faces, mat, par=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, par, smooth)


def body_rings(name, rings, mat, par=None, count=20, pleat=0):
    verts=[]
    for z, rx, ry, y in rings:
        for i in range(count):
            angle = TAU*i/count
            ripple=1+pleat*math.cos(angle*10)
            verts.append((rx*math.cos(angle)*ripple,y+ry*math.sin(angle)*ripple,z))
    faces=[]
    for j in range(len(rings)-1):
        for i in range(count):
            a=j*count+i;b=j*count+(i+1)%count
            faces.append((a,b,b+count,a+count))
    faces.extend([tuple(reversed(range(count))),tuple(range((len(rings)-1)*count,len(rings)*count))])
    return mesh(name,verts,faces,mat,par)


def ellipse(name, pos, rx, rz, mat, par=None, radius=.008):
    x,y,z=pos
    return tube(name,[(x+rx*math.cos(TAU*i/40),y,z+rz*math.sin(TAU*i/40)) for i in range(40)],radius,mat,par,True)


def strap(name, points, mat='leather', par=None, width=.022):
    return tube(name,points,width,mat,par)


def blade(name, base, length, width, mat, par=None):
    x,y,z=base
    v=[(x-width,y,z),(x,y-.014,z),(x+width,y,z),(x,y+.014,z),
       (x-width*.7,y,z+length*.75),(x,y-.011,z+length*.75),(x+width*.7,y,z+length*.75),(x,y+.011,z+length*.75),(x,y,z+length)]
    return mesh(name,v,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8)],mat,par,False)


def helmet(style, node, z=1.65):
    if style=='prussian-1870':
        # Auxonne 2010.0.72, captured in November 1870: leather shell,
        # brass cruciform spike base, peak and neck guard. The numbered
        # regiment's distinctive extra scroll is not copied onto the family.
        node=pivot('prussian_1870_leather_helmet',(0,0,z+.12),node)
        body_rings('black_leather_shell',[(z+.037,.102,.105,0),(z+.084,.109,.106,0),(z+.153,.094,.093,.003),(z+.183,.064,.063,.007),(z+.194,.001,.001,.007)],'black',node,24)
        peak=[(-.098,-.042,z+.052),(-.107,-.106,z+.025),(-.065,-.155,z+.016),(0,-.165,z+.013),(.065,-.155,z+.016),(.107,-.106,z+.025),(.098,-.042,z+.052)]
        mesh('leather_front_peak',peak,[tuple(range(7))],'black',node,False)
        tube('brass_peak_edge',peak[1:6],.003,'bronze',node)
        neck=[(-.10,.037,z+.053),(-.102,.114,z+.015),(-.061,.149,z+.009),(.061,.149,z+.009),(.102,.114,z+.015),(.10,.037,z+.053)]
        mesh('leather_neck_guard',neck,[tuple(range(6))],'black',node,False)
        for axis in range(2):
            points=[(.083*math.cos(axis*math.pi/2)*t,.078*math.sin(axis*math.pi/2)*t+.007,z+.191-.043*t*t) for t in [-1,-.5,0,.5,1]]
            strap('brass_cruciform_spike_base',points,'bronze',node,.014)
        spike=pivot('prussian_helmet_spike',(0,.007,z+.205),node)
        cylinder('spike_socket',(0,.007,z+.187),(0,.007,z+.214),.021,'bronze',spike,vertices=16)
        cylinder('tapered_brass_spike',(0,.007,z+.211),(0,.007,z+.282),.030,'bronze',spike,vertices=16,radius2=.001)
        # Original, simplified winged front plate; no legible regimental text.
        plate=pivot('prussian_plain_eagle_plate',(0,-.101,z+.102),node)
        for sign in [-1,1]:
            mesh('eagle_wing',[(sign*.009,-.107,z+.072),(sign*.072,-.080,z+.103),(sign*.079,-.073,z+.151),(sign*.041,-.098,z+.135),(sign*.026,-.105,z+.100)],[(0,1,2,3,4)],'bronze',plate,False)
        sphere('eagle_body',(0,-.11,z+.10),(.022,.008,.039),'bronze',plate,12,6)
        cylinder('eagle_neck',(0,-.107,z+.124),(0,-.101,z+.149),.009,'bronze',plate,vertices=8)
        box('eagle_crown',(0,-.102,z+.157),(.023,.012,.014),'bronze',plate,.002)
        # The surviving object's chin scales are incomplete; this small
        # retaining strap is schematic, not a claim of intact provenance.
        tube('plain_helmet_chinstrap',[(-.103,-.006,z+.048),(-.09,-.061,z-.001),(0,-.10,z-.01),(.09,-.061,z-.001),(.103,-.006,z+.048)],.005,'black',node)
        return
    if style=='french-1870':
        # Surviving 28th Infantry kepi, Musée de l'Armée: low soft red
        # cloth crown, blue band and black visor; no NCO braid or number.
        node=pivot('french_1870_kepi',(0,0,z+.08),node)
        body_rings('dark_blue_kepi_band',[(z+.027,.109,.100,0),(z+.071,.112,.105,0)],'blue',node,20)
        body_rings('soft_garance_kepi_crown',[(z+.070,.112,.105,0),(z+.112,.117,.104,.005),(z+.137,.102,.091,.013),(z+.140,.001,.001,.013)],'garance',node,20,.034)
        visor=[(-.099,-.065,z+.027),(-.112,-.109,z+.014),(-.074,-.166,z+.005),(0,-.181,z+.003),(.074,-.166,z+.005),(.112,-.109,z+.014),(.099,-.065,z+.027)]
        mesh('short_black_kepi_visor',visor,[tuple(range(7))],'black',node,False)
        tube('kepi_chinstrap',[(-.104,-.042,z+.056),(-.079,-.086,z+.039),(0,-.114,z+.034),(.079,-.086,z+.039),(.104,-.042,z+.056)],.004,'black',node)
        tube('plain_kepi_seam',[(0,-.105,z+.075),(0,-.106,z+.113),(0,-.089,z+.139),(0,.076,z+.137)],.002,'blue',node)
        return
    if style=='russian-russo-winter':
        # US observers pp.18–19; Hare 1905 p.238: shaggy black sheepskin
        # winter headwear, not the peaked service cap or a later ushanka.
        node=pivot('russian_papakha',(0,0,z+.095),node)
        body_rings('black_sheepskin_hat',[(z-.005,.109,.101,0),(z+.040,.136,.119,0),(z+.145,.132,.119,0),(z+.205,.104,.095,0),(z+.217,.02,.02,0)],'black',node,20,.048)
        for row in range(3):
            for i in range(20):
                a=i*TAU/20+row*.16+.06*math.sin(i*3.7)
                r=.127+.009*math.sin(i*2.3+row)
                h=z+.026+row*.058+.015*math.sin(i*4.1+row)
                cylinder('shaggy_wool_lock',(r*math.cos(a),r*.89*math.sin(a),h),(r*1.065*math.cos(a+.09),r*.95*math.sin(a+.09),h-.021-.012*math.sin(i*2.6)),.009,'black',node,vertices=5,radius2=.003)
        return
    if style=='japanese-russo-winter':
        # Hokkaido Museum 014751: low blue wool crown, yellow band and
        # piping, black leather visor and chinstrap, small brass star.
        node=pivot('japanese_service_cap',(0,0,z+.075),node)
        body_rings('yellow_cap_band',[(z+.030,.112,.105,0),(z+.068,.114,.105,0)],'cap_yellow',node,20)
        body_rings('blue_wool_crown',[(z+.066,.113,.106,0),(z+.108,.137,.120,0),(z+.130,.125,.111,0)],'japanese_navy',node,20)
        tube('yellow_crown_piping',[(.126*math.cos(i*TAU/24),.112*math.sin(i*TAU/24),z+.129) for i in range(24)],.003,'cap_yellow',node,True)
        visor=[(-.105,-.06,z+.03),(-.122,-.115,z+.015),(-.08,-.181,z+.003),(0,-.196,z-.001),(.08,-.181,z+.003),(.122,-.115,z+.015),(.105,-.06,z+.03)]
        mesh('black_leather_visor',visor,[tuple(range(7))],'black',node,False)
        tube('cap_chinstrap',[(-.107,-.04,z+.05),(-.075,-.10,z+.03),(0,-.117,z+.022),(.075,-.10,z+.03),(.107,-.04,z+.05)],.006,'black',node)
        points=[(0,-.113,z+.087)]
        for i in range(10):
            a=math.pi/2+i*math.pi/5;r=.018 if i%2==0 else .008
            points.append((r*math.cos(a),-.114,z+.087+r*math.sin(a)))
        mesh('small_brass_cap_star',points,[(0,i+1,(i+1)%10+1) for i in range(10)],'bronze',node,False)
        for sign in [-1,1]:sphere('chinstrap_button',(sign*.112,-.032,z+.05),(.006,.008,.008),'bronze',node,8,4)
        return
    if style=='mexican-war':
        # NPS chapter 4 / appendix C: cylindrical post-1839 infantry shako.
        # Unnumbered plate and simple pompon avoid inventing a regiment.
        node=pivot('mexican_cylindrical_shako',(0,0,z+.09),node)
        body_rings('black_leather_cylinder',[(z+.01,.110,.103,0),(z+.19,.114,.105,0),(z+.218,.114,.105,0)],'black',node,20)
        cylinder('flat_shako_top',(0,0,z+.216),(0,0,z+.223),.114,'black',node,vertices=20)
        visor=[(-.106,-.06,z+.016),(-.116,-.115,z+.003),(-.075,-.17,z-.008),(0,-.18,z-.012),(.075,-.17,z-.008),(.116,-.115,z+.003),(.106,-.06,z+.016)]
        mesh('shako_leather_visor',visor,[tuple(range(7))],'black',node,False)
        sphere('plain_brass_shako_plate',(0,-.106,z+.094),(.034,.007,.044),'bronze',node,16,8)
        for rad,mat,depth in [(.023,'red',-.108),(.016,'white',-.113),(.009,'olive',-.118)]:
            sphere('tricolour_cockade',(0,depth,z+.18),(rad,.005,rad),mat,node,12,6)
        cylinder('pompon_stalk',(0,-.068,z+.219),(0,-.068,z+.244),.008,'black',node,vertices=8)
        sphere('red_wool_pompon',(0,-.068,z+.264),(.029,.024,.031),'red',node,12,8)
        tube('shako_cord',[(-.102,-.047,z+.17),(-.080,-.101,z+.13),(0,-.115,z+.145),(.080,-.101,z+.13),(.102,-.047,z+.17)],.004,'white',node)
        tube('scaled_chinstrap',[(-.108,-.01,z+.014),(-.09,-.078,z-.14),(0,-.11,z-.185),(.09,-.078,z-.14),(.108,-.01,z+.014)],.008,'bronze',node)
        return
    if style=='austrian-seven-years':
        # Ligne portrait in the contemporary Albertina manuscript (1762).
        # Three distinct cocked sides; no Kaskett (introduced 1767) or shako.
        node=pivot('austrian_tricorne',(0,0,z+.06),node)
        body_rings('felt_crown',[(z+.01,.110,.104,0),(z+.10,.103,.096,0),(z+.14,.065,.063,0),(z+.15,.012,.012,0)],'black',node,16)
        corners=[(-.25,-.12),(.25,-.12),(0,.23)]
        for i in range(3):
            a=corners[i];b=corners[(i+1)%3]
            edge=[];inner=[]
            for j in range(9):
                t=j/8;px=a[0]*(1-t)+b[0]*t;py=a[1]*(1-t)+b[1]*t
                edge.append((px,py,z+.03+.15*math.sin(t*math.pi)))
                inner.append((px*.43,py*.43,z+.012))
            mesh('cocked_felt_brim',edge+inner,[(j,j+1,j+10,j+9) for j in range(8)],'black',node,False)
            tube('white_hat_binding',edge,.005,'white',node)
        tube('hat_loop',[(-.055,-.127,z+.174),(-.04,-.132,z+.12),(-.02,-.128,z+.175)],.006,'white',node)
        return
    if style=='french-revolution':
        # Lesueur D.9065 and the Army Museum's pre-1806 cocked hat family.
        # Wide upturned felt brims; no shako cylinder or invented company plume.
        node=pivot('french_cocked_hat',(0,0,z+.07),node)
        body_rings('felt_hat_crown',[(z+.015,.115,.109,0),(z+.09,.105,.099,0),(z+.14,.065,.062,0),(z+.15,.01,.01,0)],'black',node,16)
        for side in [-1,1]:
            outline=[(-.25,side*.022,z+.035),(-.18,side*.090,z+.102),(-.085,side*.116,z+.20),(.08,side*.116,z+.20),(.18,side*.090,z+.102),(.25,side*.022,z+.035)]
            lower=[(x,side*.105,z+.023) for x in [-.18,-.08,.08,.18]]
            mesh('upturned_felt_brim',outline+list(reversed(lower)),[tuple(range(10))],'black',node,False)
            tube('felt_bound_edge',outline,.005,'cloth_dark',node)
        sphere('plain_cockade',(-.14,-.105,z+.118),(.022,.006,.022),'white',node,12,6)
        sphere('cockade_centre',(-.14,-.112,z+.118),(.012,.004,.012),'red',node,10,6)
        return
    if style=='ottoman-ww1':
        # AWM REL/01813: sewn soft crown and folded fabric tails, not metal.
        node=pivot('ottoman_cloth_cap',(0,0,z+.06),node)
        body_rings('serge_cap_crown',[(z+.03,.110,.106,.008),(z+.085,.107,.103,.008),(z+.16,.081,.079,.010),(z+.215,.028,.029,.007),(z+.22,.004,.004,.006)],'cloth',node,24)
        for side in [-1,1]:
            # Fold rises over the brow and descends into a triangular nape flap.
            vertices=[(side*x,y,z+h) for x,y,h in [(.005,-.117,.045),(.005,-.117,.10),(.098,-.056,.092),(.115,.024,.056),(.076,.113,.022),(.052,.122,-.020),(.114,.053,.002),(.122,-.010,.012),(.085,-.085,.029)]]
            mesh('folded_serge_tail',vertices,[tuple(range(len(vertices)))],'cloth',node,False)
            tube('cap_fold_edge',vertices[:6],.006,'linen',node)
        tube('crown_longitudinal_seam',[(0,-.096,z+.07),(0,-.072,z+.155),(0,.006,z+.222),(0,.077,z+.15),(0,.105,z+.06)],.0025,'linen',node)
        return
    if style=='zulu-war-british':
        # Foreign-service helmet silhouette in Butler's 1879 Jenkins study.
        # Cloth cover and rolled rim; no invented regiment badge or metal spike.
        node=pivot('foreign_service_helmet',(0,0,z),node)
        body_rings('helmet_crown',[(z+.065,.133,.139,.014),(z+.15,.119,.116,.012),(z+.235,.066,.061,.012),(z+.26,.012,.012,.012)],'linen',node,24)
        sphere('helmet_brim',(0,.02,z+.065),(.181,.205,.019),'linen',node,24,8)
        tube('helmet_rolled_edge',[(.174*math.cos(t*TAU/32),.02+.198*math.sin(t*TAU/32),z+.064) for t in range(32)],.008,'white',node,True)
        for angle in [0,TAU/4,TAU/2,3*TAU/4]:
            tube('helmet_cover_seam',[(r*math.cos(angle),.012+r*.97*math.sin(angle),z+h) for r,h in [(.132,.073),(.117,.15),(.066,.235),(.011,.26)]],.0028,'white',node)
        tube('helmet_chinstrap',[(-.127,-.005,z+.047),(-.092,-.081,z-.135),(0,-.104,z-.19),(.092,-.081,z-.135),(.127,-.005,z+.047)],.007,'leather',node)
        return
    if style=='byzantine':
        # Segmented bowl, cheekpieces and mail nape: Met 42.50.1 family.
        # Plain bands deliberately omit diplomatic gilding and elite decoration.
        body_rings('spangen_bowl',[(z+.01,.128,.121,0),(z+.08,.116,.110,0),(z+.15,.075,.071,0),(z+.19,.01,.01,0)],'iron',node)
        for angle in [TAU*i/6 for i in range(6)]:
            tube('helmet_segment_band',[(r*math.cos(angle),r*.95*math.sin(angle),z+h) for r,h in [(.129,.01),(.117,.08),(.077,.15),(.009,.19)]],.009,'bronze',node)
        tube('helmet_brow_band',[(.129*math.cos(TAU*i/32),.122*math.sin(TAU*i/32),z+.015) for i in range(32)],.015,'iron',node,True)
        for sign in [-1,1]:
            box('spangen_cheekpiece',(sign*.092,-.058,z-.084),(.031,.038,.143),'iron',node,.012)
        for row in range(7):
            h=z-.04-row*.019
            tube('mail_nape_row',[(.115*math.cos(t*math.pi/16),.031+.104*math.sin(t*math.pi/16),h) for t in range(17)],.008,'iron',node)
        return
    if style in ['tercio','civil-war-pike']:
        sphere('pike_helmet_bowl',(0,.01,z+.055),(.123,.135,.127),'iron',node)
        if style=='tercio':
            # Morion with raised prow/stern brim and a longitudinal comb.
            brim=[(.165*math.cos(TAU*i/32),.20*math.sin(TAU*i/32),z+.013+.060*abs(math.sin(TAU*i/32))**4) for i in range(32)]
            inner=[(.106*math.cos(TAU*i/32),.114*math.sin(TAU*i/32),z+.013) for i in range(32)]
            mesh('morion_brim',brim+inner,[(i,(i+1)%32,(i+1)%32+32,i+32) for i in range(32)],'iron',node)
            tube('morion_bound_edge',brim,.008,'steel',node,True)
            mesh('morion_comb',[(-.009,-.12,z+.10),(-.009,-.07,z+.22),(-.009,.055,z+.25),(-.009,.14,z+.10),(.009,-.12,z+.10),(.009,-.07,z+.22),(.009,.055,z+.25),(.009,.14,z+.10)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3)],'iron',node)
        else:
            sphere('pot_brim',(0,.006,z+.004),(.177,.196,.015),'iron',node)
            tube('pot_centre_ridge',[(0,-.115,z+.09),(0,-.065,z+.177),(0,.08,z+.17),(0,.137,z+.06)],.011,'steel',node)
        for sign in [-1,1]:
            tube('helmet_strap',[(sign*.115,-.025,z-.02),(sign*.063,-.079,z-.16),(0,-.091,z-.185)],.006,'leather',node)
        return
    if style=='republican':
        body_rings('bronze_helmet',[(z+.015,.123,.118,.01),(z+.08,.11,.105,.01),(z+.14,.054,.052,.01),(z+.15,.01,.01,.01)],'bronze',node)
        sphere('helmet_neck_guard',(0,.057,z-.015),(.138,.137,.015),'bronze',node)
        for sign in [-1,1]:
            box('helmet_cheek',(sign*.089,-.059,z-.077),(.035,.025,.132),'bronze',node,.012)
        return
    if style=='persian':
        sphere('soft_tiara',(0,.015,z+.08),(.116,.103,.15),'cloth_dark',node)
        sphere('folded_cap_tip',(.055,.025,z+.185),(.077,.072,.060),'cloth_dark',node)
        return
    if style=='longbow':
        sphere('cloth_cap',(0,.015,z+.03),(.108,.099,.085),'cloth_dark',node)
        return
    if style=='tricorne':
        sphere('felt_hat_crown',(0,.015,z+.075),(.12,.11,.095),'black',node)
        brim=[(-.22,.12,z+.018),(-.18,-.13,z+.055),(0,-.24,z+.035),(.18,-.13,z+.055),(.22,.12,z+.018),(0,.19,z+.075)]
        mesh('cocked_hat_brim',brim,[tuple(range(len(brim)))],'black',node,False)
        tube('hat_binding',brim,.013,'linen',node,True)
        return
    if style in ['british-rifle','german-rifle','french-rifle']:
        sphere('steel_helmet',(0,0,z+.035),(.132,.143,.10),'olive' if style=='british-rifle' else 'iron',node)
        if style=='british-rifle':
            sphere('brodie_brim',(0,-.004,z+.003),(.187,.191,.016),'olive',node)
        elif style=='german-rifle':
            tube('stahlhelm_neck_skirt',[(-.135,-.04,z-.03),(-.14,.055,z-.105),(-.08,.133,z-.12),(.08,.133,z-.12),(.14,.055,z-.105),(.135,-.04,z-.03)],.035,'iron',node)
            sphere('helmet_peak',(0,-.109,z+.006),(.145,.081,.019),'iron',node)
        else:
            sphere('adrian_brim',(0,-.007,z+.002),(.154,.174,.014),'iron',node)
            tube('adrian_crest',[(0,-.12,z+.083),(0,-.06,z+.144),(0,.07,z+.146),(0,.133,z+.08)],.023,'iron',node)
        return
    if style=='plate':
        sphere('bacinet_skull',(0,.015,z+.035),(.13,.13,.143),'steel',node)
        body_rings('mail_aventail',[(z-.21,.17,.13,.015),(z-.09,.13,.12,.015)],'iron',node)
        mesh('pointed_visor',[(-.105,-.075,z+.014),(.105,-.075,z+.014),(.09,-.097,z-.12),(-.09,-.097,z-.12),(0,-.205,z-.055)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'steel',node,False)
        box('visor_eye_slit',(0,-.129,z-.009),(.143,.011,.012),'black',node,.002)
        return
    if style in ['neutral','zulu','han']:
        sphere('close_hair',(0,.009,z+.025),(.099,.090,.092),'mane',node)
        return
    if style in ['ottoman','mughal']:
        sphere('cloth_headwrap',(0,.004,z+.055),(.138,.13,.09),'linen',node)
        for i in range(4):
            tube('turban_fold',[(.13*math.cos(t*TAU/24),.12*math.sin(t*TAU/24),z+.02+i*.024+.011*math.cos(t*TAU/24)) for t in range(24)],.008,'white',node,True)
        return
    if style=='musket':
        body_rings('forage_cap',[(z+.015,.104,.10,0),(z+.065,.10,.089,.012),(z+.085,.09,.08,.012)],'cloth_dark',node)
        sphere('cap_peak',(0,-.079,z+.016),(.12,.10,.011),'leather',node)
        return
    if style=='shako':
        body_rings('felt_crown',[(z-.005,.105,.10,0),(z+.16,.092,.083,.01),(z+.185,.09,.08,.01)],'black',node)
        sphere('leather_peak',(0,-.075,z),(.13,.13,.015),'leather',node)
        cylinder('cap_braid',(-.09,-.083,z+.06),(.09,-.083,z+.06),.012,'bronze',node)
        sphere('cockade',(0,-.095,z+.11),(.033,.012,.037),'bronze',node)
        tube('chinstrap',[(-.105,-.015,z-.03),(-.08,-.08,z-.17),(0,-.105,z-.20),(.08,-.08,z-.17),(.105,-.015,z-.03)],.008,'leather',node)
        return
    if style=='rifle':
        sphere('steel_helmet',(0,0,z+.017),(.137,.14,.088),'olive',node)
        sphere('helmet_rim',(0,-.015,z-.012),(.151,.155,.016),'olive',node)
        tube('chinstrap',[(-.115,-.02,z-.04),(-.065,-.085,z-.165),(0,-.105,z-.19),(.065,-.085,z-.165),(.115,-.02,z-.04)],.008,'leather',node)
        return
    mat='bronze' if style in ['greek','plain'] else 'iron'
    body_rings('helmet_dome',[(z+.016,.128,.12,.005),(z+.05,.122,.114,.005),(z+.09,.095,.089,.005),(z+.12,.048,.044,.005),(z+.131,.004,.004,.005)],mat,node)
    tube('helmet_brow',[(-.111,-.051,z+.02),(-.075,-.100,z+.017),(0,-.116,z+.017),(.075,-.100,z+.017),(.111,-.051,z+.02)],.01,'bronze' if style=='roman' else mat,node)
    if style in ['roman','medieval','east','steppe']:
        sphere('neck_guard',(0,.055,z-.085),(.155,.125,.018),mat,node)
    if style in ['greek','roman']:
        for side in [-1,1]:
            cheek=box('cheek_guard',(side*.087,-.067,z-.10),(.045,.025,.15),mat,node,.016)
            cheek.rotation_euler[1]=side*.14
        box('nose_guard',(0,-.115,z-.08),(.019,.016,.09),mat,node,.004)
    if style=='greek':
        tube('crest_holder',[(0,.105,z+.09),(0,.075,z+.15),(0,-.005,z+.16),(0,-.085,z+.11)],.018,'bronze',node)
        for i in range(14):
            y=-.10+i*.017
            cylinder('crest_hair',(0,y,z+.12),(0,y+.015,z+.245-abs(y)*.6),.012,'red',node,vertices=6)
    elif style in ['steppe','east']:
        cylinder('helmet_crown',(0,0,z+.04),(0,0,z+.19),.102,'iron',node,radius2=.017)
        if style=='east':
            for i in range(3):
                sphere('neck_lamella',(0,.078,z-.065-i*.027),(.155-i*.01,.105,.018),'iron',node)
    elif style=='medieval':
        cylinder('conical_crown',(0,0,z+.04),(0,0,z+.20),.11,'iron',node,radius2=.01)
        box('helmet_nasal',(0,-.119,z-.085),(.021,.016,.105),'iron',node,.003)


def shield(style, hand, offset=(-.37,-.20,1.06)):
    x,y,z=offset
    if style=='byzantine':
        sphere('large_oval_shield',(x,y,z),(.31,.055,.53),'wood',hand)
        ellipse('shield_hide_edge',(x,y-.025,z),.31,.53,'leather',hand,radius=.013)
        sphere('shield_iron_boss',(x,y-.065,z),(.10,.06,.10),'iron',hand)
        for sx in [-.2,-.1,.1,.2]:
            height=.50*math.sqrt(1-(sx/.31)**2)
            cylinder('shield_plank_joint',(x+sx,y-.043,z-height),(x+sx,y-.043,z+height),.003,'leather',hand,vertices=6)
    elif style=='republican':
        sphere('convex_oval_scutum',(x,y,z),(.275,.055,.465),'wood',hand)
        ellipse('scutum_iron_edge',(x,y-.025,z),.275,.465,'iron',hand,radius=.012)
        cylinder('scutum_spine',(x,y-.061,z-.37),(x,y-.061,z+.37),.017,'wood_light',hand)
        sphere('iron_umbo',(x,y-.075,z),(.080,.04,.064),'iron',hand)
    elif style=='wicker':
        box('wicker_shield_body',(x,y,z),(.45,.028,.74),'wood_light',hand,.055)
        for i in range(13):
            sx=x-.205+i*.034
            cylinder('wicker_upright',(sx,y-.025,z-.33),(sx,y-.025,z+.33),.007,'wood',hand,vertices=6)
        for i in range(19):
            sz=z-.325+i*.036
            tube('wicker_weave',[(x-.207+j*.034,y-.028+(.007 if (i+j)%2 else -.007),sz) for j in range(13)],.006,'linen',hand)
        tube('shield_binding',[(x-.215,y-.02,z-.35),(x+.215,y-.02,z-.35),(x+.215,y-.02,z+.35),(x-.215,y-.02,z+.35)],.013,'leather',hand,True)
    elif style=='roman':
        width=.43;height=.72
        # Curved wooden boards and a shallow metal frame.
        verts=[]
        for row in range(7):
            h=z-height/2+height*row/6
            for col in range(9):
                angle=-.70+1.40*col/8
                verts.append((x+math.sin(angle)*.34,y+.34*(1-math.cos(angle)),h))
        faces=[]
        for row in range(6):
            for col in range(8):
                a=row*9+col;faces.append((a,a+1,a+10,a+9))
        mesh('scutum_curved_face',verts,faces,'red',hand)
        for index in [0,8]:tube('scutum_side',[verts[row*9+index] for row in range(7)],.015,'bronze',hand)
        for row in [0,6]:tube('scutum_edge',verts[row*9:row*9+9],.015,'bronze',hand)
        for side in [-1,1]:
            tube('shield_reinforcement',[(x+side*.07,y-.016,z-.22),(x+side*.125,y-.015,z-.10),(x+side*.075,y-.016,z+.05),(x+side*.16,y-.015,z+.23)],.009,'bronze',hand)
        sphere('shield_boss',(x,y-.025,z),(.09,.058,.09),'iron',hand)
    elif style=='medieval':
        verts=[(x-.22,y,z+.25),(x-.15,y-.015,z+.38),(x,y-.025,z+.42),(x+.15,y-.015,z+.38),(x+.22,y,z+.25),(x+.20,y-.015,z+.02),(x,y-.055,z-.46),(x-.20,y-.015,z+.02)]
        mesh('kite_shield',verts,[tuple(range(8))],'wood',hand,False)
        tube('shield_rim',verts,.018,'iron',hand,True)
        tube('shield_central_rib',[(x,y-.009,z+.27),(x,y-.052,z-.30)],.016,'leather',hand)
    elif style=='zulu':
        sphere('hide_shield',(x,y,z),(.23,.025,.51),'leather',hand)
        cylinder('shield_spine',(x,y-.034,z-.56),(x,y-.034,z+.56),.012,'wood',hand)
        for i in range(10):
            h=z-.36+i*.078
            for sign in [-1,1]:box('hide_lacing',(x+sign*.047,y-.03,h),(.052,.012,.026),'linen',hand,.006)
    else:
        radius=.285 if style=='greek' else .24
        sphere('round_shield',(x,y,z),(radius,.034,radius),'wood',hand)
        ellipse('bronze_shield_rim',(x,y-.015,z),radius,radius,'bronze',hand,radius=.018)
        sphere('shield_boss',(x,y-.048,z),(.076,.046,.076),'bronze',hand)
        for i in range(-2,3):
            sx=x+i*.079;dz=math.sqrt(max(0,radius*radius-(sx-x)**2))*.88
            cylinder('plank_seam',(sx,y-.032,z-dz),(sx,y-.032,z+dz),.0028,'leather',hand,vertices=6)
        for i in range(12):
            angle=TAU*i/12
            sphere('shield_rivet',(x+radius*.87*math.cos(angle),y-.035,z+radius*.87*math.sin(angle)),(.008,.009,.008),'bronze',hand,8,4)


def weapon(kind, hand):
    x=.33;y=-.09;z=1.07
    if kind=='pike':
        grip=pivot('pike_grip',(x,y,z),hand)
        cylinder('five_metre_pike_shaft',(x,y,.08),(x,y,4.85),.019,'wood',grip)
        cylinder('pike_socket',(x,y,4.77),(x,y,4.92),.025,'iron',grip)
        blade('pike_point',(x,y,4.88),.22,.032,'steel',grip)
        cylinder('pike_butt',(x,y,.05),(x,y,.20),.025,'iron',grip)
    elif kind=='short-spear':
        cylinder('spear_shaft',(x,y,.56),(x,y,1.25),.016,'wood',hand)
        blade('broad_spearhead',(x,y,1.22),.29,.046,'iron',hand)
    elif kind=='spear':
        cylinder('spear_shaft',(x,y,.16),(x,y,1.99),.015,'wood',hand)
        blade('spearhead',(x,y,1.95),.22,.035,'steel',hand)
        cylinder('spear_socket',(x,y,1.89),(x,y,1.97),.021,'iron',hand)
        cylinder('spear_butt',(x,y,.11),(x,y,.23),.018,'iron',hand,radius2=.009)
    elif kind=='sword':
        cylinder('sword_grip',(x,y,.98),(x,y,1.10),.023,'leather',hand)
        cylinder('sword_guard',(x-.08,y,1.11),(x+.08,y,1.11),.013,'iron',hand)
        sphere('sword_pommel',(x,y,.97),(.029,.024,.026),'bronze',hand)
        blade('sword_blade',(x,y,1.12),.54,.035,'steel',hand)
    elif kind=='longbow':
        tube('longbow_stave',[(x,.13,.22),(x,.02,.45),(x,-.06,.80),(x,-.08,1.07),(x,-.06,1.50),(x,.02,1.85),(x,.13,2.08)],.018,'wood',hand)
        tube('drawn_bowstring',[(x,.13,.22),(x,.24,1.15),(x,.13,2.08)],.0025,'linen',hand)
        cylinder('arrow',(x,.09,1.15),(x,-.74,1.15),.004,'wood_light',hand,vertices=6)
        cylinder('bodkin_point',(x,-.74,1.15),(x,-.81,1.15),.009,'iron',hand,vertices=4,radius2=0)
    elif kind=='bow':
        tube('bow_limbs',[(x,y, .80),(x-.05,y-.04,.88),(x-.12,y-.05,1.09),(x-.14,y-.035,1.29),(x-.12,y,1.49),(x-.05,y+.01,1.62),(x,y,1.70)],.018,'wood',hand)
        cylinder('bow_string',(x,y,.80),(x,y,1.70),.0023,'linen',hand,vertices=5)
        cylinder('arrow',(x,-.02,1.25),(x,-.63,1.25),.004,'wood_light',hand,vertices=6)
        cylinder('arrowhead',(x,-.64,1.25),(x,-.69,1.25),.012,'iron',hand,vertices=4,radius2=0)
    elif kind=='crossbow':
        box('crossbow_stock',(.28,-.26,1.14),(.055,.63,.065),'wood',hand,.016)
        tube('crossbow_prod',[(-.05,-.43,1.14),(.02,-.48,1.15),(.28,-.51,1.16),(.54,-.48,1.15),(.61,-.43,1.14)],.024,'wood',hand)
        tube('crossbow_string',[(-.05,-.43,1.14),(.28,-.08,1.17),(.61,-.43,1.14)],.003,'linen',hand)
        box('bronze_trigger',(.28,-.07,1.14),(.075,.08,.045),'bronze',hand,.005)
        cylinder('loaded_bolt',(.28,-.05,1.19),(.28,-.69,1.19),.006,'wood_light',hand,vertices=6)
    elif kind=='dreyse-1862':
        # Woerth BATW.1987.1.1: full 1.355 m rifle, three brass bands,
        # straight bolt, cylindrical rear cocking sleeve and finger spur.
        # No fixed bayonet: its exact type is outside this source review.
        hand=pivot('dreyse_1862',(x,-.16,1.158),hand)
        verts=[(x+dx,wy,wz) for dx in [-.037,.037] for wy,wz in [(.23,.94),(.23,1.087),(-.09,1.152),(-.126,1.103)]]
        mesh('dreyse_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('dreyse_full_forestock',(x,-.594,1.125),(.063,.995,.064),'wood',hand,.009)
        cylinder('dreyse_receiver',(x,.008,1.165),(x,-.256,1.165),.025,'steel',hand,vertices=12)
        bolt=pivot('dreyse_bolt',(x,-.128,1.165),hand)
        cylinder('dreyse_bolt_body',(x,.009,1.165),(x,-.24,1.165),.020,'iron',bolt,vertices=12)
        cylinder('dreyse_straight_handle',(x+.006,-.130,1.165),(x+.092,-.130,1.165),.009,'steel',bolt,vertices=10)
        sphere('dreyse_ball_handle',(x+.096,-.130,1.165),(.018,.018,.018),'steel',bolt,12,6)
        cock=pivot('dreyse_cocking_sleeve',(x,.007,1.165),hand)
        cylinder('dreyse_rear_sleeve',(x,-.020,1.165),(x,.025,1.165),.029,'steel',cock,vertices=16)
        cylinder('rear_knurled_rim',(x,.020,1.165),(x,.031,1.165),.034,'iron',cock,vertices=16)
        cylinder('dreyse_barrel',(x,-.249,1.166),(x,-1.122,1.166),.017,'steel',hand,vertices=12)
        for i,wy in enumerate([-.365,-.70,-1.057],1):
            band=pivot('dreyse_band_'+str(i),(x,wy,1.14),hand)
            cylinder('brass_stock_band',(x,wy-.013,1.14),(x,wy+.013,1.14),.037,'bronze',band,vertices=12)
        box('dreyse_rear_sight',(x,-.291,1.194),(.027,.048,.021),'iron',hand,.002)
        box('dreyse_front_sight',(x,-1.075,1.192),(.010,.022,.025),'iron',hand,.002)
        cylinder('dreyse_cleaning_rod',(x,-.36,1.084),(x,-1.114,1.084),.004,'steel',hand,vertices=8)
        cylinder('tulip_rod_head',(x,-1.10,1.084),(x,-1.119,1.084),.005,'steel',hand,vertices=8,radius2=.009)
        tube('dreyse_brass_trigger_guard',[(x,-.080,1.106),(x,-.085,1.053),(x,-.025,1.031),(x,.046,1.050),(x,.050,1.107)],.008,'bronze',hand)
        spur=pivot('dreyse_trigger_spur',(x,.064,1.072),hand)
        tube('curved_finger_spur',[(x,.043,1.064),(x,.068,1.068),(x,.084,1.043),(x,.110,1.039)],.010,'bronze',spur)
        box('dreyse_steel_buttplate',(x,.230,1.014),(.076,.008,.149),'steel',hand,.003)
        strap('dreyse_sling',[(x,.065,1.027),(x,-.37,.98),(x,-1.055,1.093)],'white',hand,.011)
    elif kind=='chassepot-1866':
        # Musée de l'Armée M2765: 1.31 m rifle, 1.88 m with the sabre
        # bayonet. Paper cartridge, one round; no box magazine or flintlock.
        hand=pivot('chassepot_1866',(x,-.16,1.158),hand)
        verts=[(x+dx,wy,wz) for dx in [-.036,.036] for wy,wz in [(.23,.944),(.23,1.088),(-.112,1.157),(-.145,1.105)]]
        mesh('chassepot_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('chassepot_forestock',(x,-.56,1.126),(.060,.88,.060),'wood',hand,.008)
        cylinder('chassepot_steel_receiver',(x,.015,1.165),(x,-.214,1.165),.024,'steel',hand,vertices=12)
        bolt=pivot('chassepot_bolt',(x,-.071,1.168),hand)
        cylinder('chassepot_bolt_body',(x,-.015,1.168),(x,-.193,1.168),.018,'iron',bolt,vertices=12)
        cylinder('chassepot_straight_handle',(x+.008,-.069,1.167),(x+.090,-.069,1.167),.009,'steel',bolt,vertices=10)
        sphere('chassepot_bolt_knob',(x+.096,-.069,1.167),(.016,.016,.016),'steel',bolt,12,6)
        cock=pivot('chassepot_cocking_piece',(x,.006,1.173),hand)
        tube('rear_hooked_cocking_thumbpiece',[(x,.006,1.164),(x,.027,1.183),(x,.030,1.218),(x,.006,1.233),(x,-.008,1.224)],.012,'steel',cock)
        cylinder('chassepot_barrel',(x,-.212,1.165),(x,-1.08,1.165),.016,'steel',hand,vertices=12)
        box('chassepot_rear_sight',(x,-.286,1.189),(.026,.059,.018),'iron',hand,.002)
        box('chassepot_front_sight',(x,-1.042,1.184),(.010,.022,.022),'iron',hand,.002)
        for wy in [-.49,-.964]:
            cylinder('chassepot_barrel_band',(x,wy-.010,1.145),(x,wy+.010,1.145),.033,'steel',hand,vertices=12)
        cylinder('chassepot_cleaning_rod',(x,-.34,1.088),(x,-1.06,1.088),.004,'steel',hand,vertices=8)
        tube('chassepot_trigger_guard',[(x,-.077,1.111),(x,-.072,1.064),(x,-.027,1.052),(x,.026,1.067),(x,.026,1.110)],.007,'steel',hand)
        box('chassepot_buttplate',(x,.230,1.014),(.072,.008,.14),'steel',hand,.003)
        strap('chassepot_sling',[(x,.08,1.036),(x,-.39,.989),(x,-.95,1.10)],'black',hand,.01)
        bayonet=pivot('chassepot_sabre_bayonet',(x+.046,-1.08,1.143),hand)
        cylinder('ribbed_brass_sabre_grip',(x+.046,-.955,1.143),(x+.046,-1.08,1.143),.018,'bronze',bayonet,vertices=12)
        for wy in [-.969,-.984,-.999,-1.014,-1.029,-1.044,-1.059]:
            cylinder('brass_grip_rib',(x+.046,wy-.002,1.143),(x+.046,wy+.002,1.143),.020,'bronze',bayonet,vertices=10)
        tube('sabre_hooked_quillon',[(x+.046,-1.08,1.193),(x+.046,-1.08,1.104),(x+.046,-1.058,1.092),(x+.046,-1.038,1.105)],.006,'steel',bayonet)
        # A thin flat blade with a recurved belly, unlike the socket spike
        # on the earlier flintlock families. Original simplified mesh.
        blade_verts=[]
        for dx in [-.003,.003]:
            for wy,wz,width in [(-1.084,1.140,.018),(-1.23,1.126,.019),(-1.39,1.129,.021),(-1.54,1.15,.018),(-1.65,1.175,0)]:
                blade_verts.extend([(x+.046+dx,wy,wz-width),(x+.046+dx,wy,wz+width)])
        faces=[]
        for layer in [0,10]:
            for i in range(4):faces.append((layer+2*i,layer+2*i+1,layer+2*i+3,layer+2*i+2))
        for i in range(4):
            faces.extend([(2*i,2*i+2,2*i+12,2*i+10),(2*i+1,2*i+11,2*i+13,2*i+3)])
        mesh('flat_recurved_yataghan_blade',blade_verts,faces,'steel',bayonet,False)
    elif kind=='india-pattern':
        # NPS figure 16 and lock photograph: India Pattern, 39-inch barrel,
        # about 1.40 m firearm and 15-inch offset socket bayonet blade.
        hand=pivot('india_pattern_musket',(x,-.16,1.158),hand)
        verts=[(x+dx,wy,wz) for dx in [-.037,.037] for wy,wz in [(.23,.94),(.23,1.09),(-.12,1.167),(-.16,1.104)]]
        mesh('india_pattern_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('pinned_forestock',(x,-.614,1.131),(.060,.95,.063),'wood',hand,.01)
        cylinder('india_pattern_barrel',(x,-.18,1.168),(x,-1.17,1.168),.018,'iron',hand,vertices=12)
        pipes=pivot('india_pattern_ramrod_pipes',(x,-.61,1.087),hand)
        for wy in [-.39,-.71,-1.045]:
            cylinder('brass_ramrod_pipe',(x,wy-.031,1.086),(x,wy+.031,1.086),.010,'bronze',pipes,vertices=8)
            cylinder('stock_pin',(x-.032,wy,1.132),(x+.032,wy,1.132),.003,'iron',hand,vertices=6)
        cylinder('steel_ramrod',(x,-.32,1.084),(x,-1.159,1.084),.004,'steel',hand,vertices=8)
        box('brass_buttplate',(x,.231,1.012),(.074,.009,.146),'bronze',hand,.004)
        tube('brass_trigger_guard',[(x,-.13,1.106),(x,-.115,1.044),(x,-.045,1.035),(x,.022,1.055),(x,.024,1.108)],.007,'bronze',hand)
        lock=pivot('india_pattern_flintlock',(x+.04,-.17,1.15),hand)
        box('rounded_tower_lockplate',(x+.039,-.14,1.146),(.015,.192,.047),'iron',lock,.008)
        tube('swan_neck_flint_cock',[(x+.054,-.087,1.15),(x+.059,-.048,1.19),(x+.059,-.062,1.211),(x+.059,-.113,1.23)],.009,'iron',lock)
        box('clamped_flint',(x+.059,-.136,1.234),(.029,.036,.017),'black',lock,.002)
        box('steel_frizzen',(x+.052,-.198,1.21),(.027,.014,.072),'steel',lock,.003)
        sphere('priming_pan',(x+.057,-.196,1.169),(.028,.027,.012),'iron',lock,12,6)
        strap('musket_sling',[(x,-.24,1.08),(x,-.57,1.007),(x,-1.015,1.085)],'white',hand,.012)
        bayonet=pivot('india_pattern_socket_bayonet',(x,-1.17,1.168),hand)
        cylinder('bayonet_socket',(x,-1.115,1.168),(x,-1.182,1.168),.024,'iron',bayonet,vertices=12)
        tube('bayonet_offset_elbow',[(x+.018,-1.17,1.168),(x+.055,-1.194,1.168)],.010,'steel',bayonet)
        cylinder('triangular_bayonet_blade',(x+.055,-1.194,1.168),(x+.055,-1.575,1.168),.014,'steel',bayonet,vertices=3,radius2=.001)
    elif kind=='austrian-flintlock':
        # M1754 service context in the official Hessenspiegel, p.22; the VHÚ
        # M1722/30 object supplies the earlier pinned-stock family silhouette.
        # Approximate 1.39 m firearm plus socket bayonet, not an exact object copy.
        hand=pivot('austrian_flintlock_musket',(x,-.16,1.158),hand)
        verts=[(x+dx,wy,wz) for dx in [-.038,.038] for wy,wz in [(.23,.944),(.23,1.09),(-.12,1.166),(-.15,1.10)]]
        mesh('curved_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('pinned_wooden_forestock',(x,-.605,1.131),(.057,.97,.061),'wood',hand,.010)
        cylinder('smoothbore_barrel',(x,-.13,1.167),(x,-1.16,1.167),.017,'iron',hand,vertices=12)
        for wy in [-.36,-.69,-1.02]:
            cylinder('stock_retaining_pin',(x-.031,wy,1.131),(x+.031,wy,1.131),.003,'iron',hand,vertices=6)
            cylinder('ramrod_pipe',(x,wy-.025,1.086),(x,wy+.025,1.086),.009,'iron',hand,vertices=8)
        cylinder('steel_ramrod',(x,-.27,1.085),(x,-1.151,1.085),.004,'steel',hand,vertices=8)
        tube('trigger_guard',[(x,-.13,1.106),(x,-.115,1.05),(x,-.06,1.044),(x,.005,1.06),(x,.008,1.105)],.007,'iron',hand)
        lock=pivot('austrian_flintlock_action',(x+.04,-.17,1.15),hand)
        box('rounded_lock_plate',(x+.038,-.13,1.145),(.014,.17,.043),'iron',lock,.006)
        tube('flint_cock',[(x+.053,-.071,1.15),(x+.058,-.040,1.192),(x+.058,-.088,1.225)],.010,'iron',lock)
        box('clamped_flint',(x+.058,-.115,1.225),(.028,.038,.019),'black',lock,.002)
        box('steel_frizzen',(x+.05,-.178,1.211),(.025,.014,.067),'steel',lock,.003)
        sphere('priming_pan',(x+.056,-.177,1.17),(.028,.026,.012),'iron',lock,12,6)
        strap('musket_sling',[(x,-.24,1.082),(x,-.55,1.009),(x,-1.02,1.086)],'linen',hand,.012)
        cylinder('socket_bayonet_mount',(x,-1.11,1.167),(x,-1.172,1.167),.023,'iron',hand,vertices=12)
        tube('bayonet_elbow',[(x+.018,-1.16,1.167),(x+.052,-1.185,1.167)],.009,'steel',hand)
        cylinder('socket_bayonet_blade',(x+.052,-1.185,1.167),(x+.052,-1.55,1.167),.014,'steel',hand,vertices=3,radius2=.001)
    elif kind=='french-1777':
        # Museum M 459: 1.52 m long, 1.92 m with its socket bayonet.
        # Flint, cock, frizzen and priming pan distinguish the muzzle-loader.
        hand=pivot('french_flintlock_musket',(x,-.16,1.158),hand)
        verts=[(x+dx,y,z) for dx in [-.036,.036] for y,z in [(.23,.95),(.23,1.095),(-.12,1.165),(-.15,1.105)]]
        mesh('flintlock_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('long_wooden_forestock',(x,-.68,1.13),(.052,1.10,.058),'wood',hand,.008)
        cylinder('smoothbore_barrel',(x,-.14,1.163),(x,-1.29,1.163),.016,'iron',hand,vertices=12)
        for y in [-.32,-.77,-1.21]:
            cylinder('iron_barrel_band',(x,y-.011,1.146),(x,y+.011,1.146),.033,'iron',hand,vertices=12)
        cylinder('ramrod',(x,-.29,1.091),(x,-1.28,1.091),.004,'steel',hand,vertices=8)
        tube('brass_trigger_guard',[(x,-.13,1.106),(x,-.115,1.054),(x,-.065,1.046),(x,-.014,1.06),(x,-.015,1.111)],.007,'bronze',hand)
        lock=pivot('flintlock_action',(x+.04,-.17,1.15),hand)
        box('lock_plate',(x+.034,-.14,1.141),(.014,.15,.042),'iron',lock,.004)
        tube('flint_cock',[(x+.05,-.09,1.146),(x+.057,-.062,1.192),(x+.057,-.106,1.218)],.010,'iron',lock)
        box('clamped_flint',(x+.057,-.129,1.218),(.027,.042,.020),'black',lock,.002)
        box('steel_frizzen',(x+.05,-.184,1.206),(.025,.014,.066),'steel',lock,.003)
        sphere('brass_priming_pan',(x+.055,-.182,1.17),(.029,.026,.012),'bronze',lock,12,6)
        strap('musket_sling',[(x,-.25,1.085),(x,-.59,1.015),(x,-1.17,1.093)],'linen',hand,.012)
        cylinder('socket_bayonet_mount',(x,-1.235,1.163),(x,-1.302,1.163),.022,'iron',hand,vertices=12)
        tube('bayonet_elbow',[(x+.017,-1.29,1.163),(x+.052,-1.317,1.163)],.009,'steel',hand)
        cylinder('triangular_socket_bayonet',(x+.052,-1.316,1.163),(x+.052,-1.69,1.163),.014,'steel',hand,vertices=3,radius2=.001)
    elif kind=='mosin-1891':
        # Royal Armouries 34129, about 1900: full 1.306 m infantry rifle.
        # Straight bolt, round cocking knob, projecting integral magazine,
        # low blade foresight, plain early leaf sight; no 1891/30 fittings.
        hand=pivot('mosin_1891_rifle',(x,-.16,1.158),hand)
        verts=[(x+dx,y,z) for dx in [-.035,.035] for y,z in [(.23,.967),(.23,1.105),(-.077,1.164),(-.16,1.106)]]
        mesh('mosin_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('mosin_full_stock',(x,-.546,1.128),(.061,.79,.065),'wood',hand,.01)
        cylinder('mosin_receiver',(x,-.065,1.178),(x,-.258,1.178),.024,'iron',hand,vertices=8)
        magazine=pivot('mosin_integral_magazine',(x,-.20,1.067),hand)
        verts=[(x+dx,y,z) for dx in [-.024,.024] for y,z in [(-.151,1.111),(-.284,1.111),(-.269,1.007),(-.184,1.007)]]
        mesh('fixed_five_round_box',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'iron',magazine,False)
        bolt=pivot('mosin_straight_bolt',(x,-.09,1.18),hand)
        cylinder('mosin_bolt_body',(x,-.029,1.183),(x,-.234,1.183),.015,'steel',bolt,vertices=12)
        cylinder('mosin_cocking_knob',(x,-.01,1.183),(x,.017,1.183),.024,'steel',bolt,vertices=12)
        cylinder('mosin_bolt_handle',(x+.010,-.103,1.18),(x+.095,-.103,1.18),.008,'steel',bolt,vertices=10)
        sphere('mosin_bolt_ball',(x+.101,-.103,1.18),(.016,.016,.016),'steel',bolt,10,6)
        cylinder('mosin_barrel',(x,-.260,1.18),(x,-1.076,1.18),.014,'dark_metal',hand,vertices=12)
        box('mosin_upper_handguard',(x,-.660,1.191),(.042,.43,.023),'wood',hand,.006)
        box('mosin_early_leaf_sight',(x,-.361,1.206),(.025,.094,.012),'iron',hand,.002)
        box('mosin_unhooded_front_sight',(x,-1.048,1.201),(.010,.018,.022),'iron',hand,.002)
        for y in [-.57,-.895]:cylinder('mosin_stock_band',(x,y-.009,1.151),(x,y+.009,1.151),.034,'dark_metal',hand,vertices=12)
        tube('mosin_trigger_guard',[(x,-.153,1.107),(x,-.143,1.049),(x,-.097,1.042),(x,-.058,1.058),(x,-.058,1.11)],.006,'iron',hand)
        cylinder('mosin_cleaning_rod',(x,-.45,1.096),(x,-1.056,1.096),.004,'steel',hand,vertices=8)
        strap('mosin_leather_sling',[(x,.085,1.018),(x,-.38,.977),(x,-.882,1.108)],'leather',hand,.010)
        # Tula museum: four-sided cruciform needle blade. Socket offset to
        # the rifle's right, no knife handle or Japanese hooked quillon.
        bayonet=pivot('mosin_socket_bayonet',(x,-1.053,1.18),hand)
        cylinder('mosin_socket',(x,-1.017,1.18),(x,-1.076,1.18),.020,'steel',bayonet,vertices=12)
        cylinder('mosin_socket_elbow',(x,-1.042,1.18),(x+.056,-1.087,1.18),.009,'steel',bayonet,vertices=8)
        points=[]
        cross=[(-.009,0),(-.003,.003),(0,.009),(.003,.003),(.009,0),(.003,-.003),(0,-.009),(-.003,-.003)]
        for y,scale in [(-1.083,1),(-1.45,.7),(-1.507,.06)]:
            points.extend([(x+.056+dx*scale,y,1.18+dz*scale) for dx,dz in cross])
        faces=[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]+[(i+8,(i+1)%8+8,(i+1)%8+16,i+16) for i in range(8)]
        mesh('mosin_cruciform_spike',points,faces,'steel',bayonet,False)
    elif kind=='type30':
        # Armémuseum INV 32458 / Smithsonian AF.30000: 1.28 m full-length
        # Type 30, straight bolt and rear hooked cocking piece. Not Type 38.
        hand=pivot('type30_rifle',(x,-.16,1.158),hand)
        verts=[(x+dx,y,z) for dx in [-.035,.035] for y,z in [(.23,.966),(.23,1.108),(-.075,1.168),(-.15,1.103)]]
        mesh('type30_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('type30_full_stock',(x,-.553,1.129),(.060,.79,.061),'wood',hand,.012)
        cylinder('type30_receiver',(x,-.062,1.178),(x,-.258,1.178),.023,'iron',hand,vertices=12)
        box('type30_internal_floorplate',(x,-.238,1.090),(.053,.155,.012),'iron',hand,.005)
        bolt=pivot('type30_bolt',(x,-.096,1.18),hand)
        cylinder('type30_bolt_body',(x,-.035,1.183),(x,-.24,1.183),.015,'steel',bolt,vertices=12)
        cylinder('type30_straight_bolt_handle',(x+.010,-.095,1.18),(x+.09,-.095,1.18),.008,'steel',bolt,vertices=10)
        sphere('type30_bolt_knob',(x+.094,-.095,1.18),(.016,.016,.016),'steel',bolt,10,6)
        tube('type30_hooked_cocking_piece',[(x,-.04,1.183),(x,.004,1.183),(x,.010,1.20),(x,-.002,1.21)],.007,'steel',bolt)
        cylinder('type30_barrel',(x,-.247,1.18),(x,-1.051,1.18),.014,'dark_metal',hand,vertices=12)
        box('type30_upper_handguard',(x,-.567,1.185),(.045,.22,.022),'wood',hand,.007)
        box('type30_rear_sight',(x,-.395,1.202),(.03,.11,.014),'iron',hand,.002)
        box('type30_front_sight',(x,-1.019,1.201),(.013,.022,.022),'iron',hand,.002)
        for y in [-.69,-.967]:cylinder('type30_stock_band',(x,y-.008,1.149),(x,y+.008,1.149),.032,'dark_metal',hand,vertices=12)
        tube('type30_trigger_guard',[(x,-.156,1.107),(x,-.14,1.061),(x,-.10,1.056),(x,-.055,1.071),(x,-.055,1.117)],.006,'iron',hand)
        cylinder('type30_cleaning_rod',(x,-.52,1.099),(x,-1.036,1.099),.004,'steel',hand,vertices=8)
        strap('type30_leather_sling',[(x,.085,1.021),(x,-.38,.995),(x,-.925,1.106)],'leather',hand,.010)
        # Long knife bayonet, not a socket spike; 400 mm blade is the
        # Korean War Memorial's documented design dimension.
        bayonet=pivot('type30_knife_bayonet',(x,-1.05,1.126),hand)
        box('bayonet_wood_grip',(x,-.996,1.126),(.028,.10,.033),'wood',bayonet,.006)
        tube('bayonet_muzzle_ring',[(x+.023*math.cos(i*TAU/16),-1.052,1.180+.023*math.sin(i*TAU/16)) for i in range(16)],.004,'steel',bayonet,True)
        tube('bayonet_hooked_quillon',[(x,-1.052,1.18),(x,-1.052,1.097),(x,-1.04,1.075),(x,-1.015,1.072),(x,-1.002,1.083)],.005,'steel',bayonet)
        verts=[(x+dx,y,z) for dx in [-.003,.003] for y,z in [(-1.055,1.112),(-1.055,1.140),(-1.38,1.140),(-1.455,1.134),(-1.38,1.115)]]
        mesh('long_knife_blade',verts,[(0,1,2,3,4),(5,9,8,7,6),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)],'steel',bayonet,False)
    elif kind=='mauser-1893':
        # AWM RELAWM00308.001: long wooden stock, straight bolt, internal
        # magazine and cleaning rod. No Martini lever or detachable magazine.
        hand=pivot('mauser_rifle',(x,-.16,1.158),hand)
        verts=[(x+dx,y,z) for dx in [-.035,.035] for y,z in [(.23,.966),(.22,1.108),(-.08,1.168),(-.15,1.102)]]
        mesh('mauser_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('mauser_full_stock',(x,-.525,1.128),(.060,.78,.060),'wood',hand,.014)
        cylinder('mauser_receiver',(x,-.065,1.178),(x,-.245,1.178),.024,'iron',hand,vertices=16)
        box('internal_magazine_floorplate',(x,-.238,1.093),(.057,.155,.012),'iron',hand,.006)
        bolt=pivot('mauser_bolt',(x,-.105,1.18),hand)
        cylinder('bolt_body',(x,-.055,1.183),(x,-.203,1.183),.016,'steel',bolt,vertices=12)
        cylinder('straight_bolt_handle',(x+.010,-.099,1.18),(x+.090,-.099,1.18),.009,'steel',bolt,vertices=12)
        sphere('bolt_knob',(x+.093,-.099,1.18),(.017,.017,.017),'steel',bolt,12,8)
        cylinder('mauser_barrel',(x,-.243,1.171),(x,-1.015,1.171),.015,'dark_metal',hand,vertices=16)
        cylinder('mauser_muzzle',(x,-1.014,1.171),(x,-1.025,1.171),.017,'iron',hand,vertices=16)
        box('mauser_rear_sight',(x,-.33,1.195),(.030,.070,.018),'iron',hand,.003)
        box('mauser_front_sight',(x,-.975,1.194),(.012,.025,.029),'iron',hand,.002)
        for y in [-.54,-.90]:
            cylinder('mauser_barrel_band',(x,y-.009,1.146),(x,y+.009,1.146),.033,'dark_metal',hand,vertices=16)
        tube('mauser_trigger_guard',[(x,-.15,1.106),(x,-.14,1.062),(x,-.10,1.052),(x,-.055,1.068),(x,-.055,1.115)],.007,'iron',hand)
        cylinder('mauser_cleaning_rod',(x,-.40,1.102),(x,-1.007,1.102),.004,'steel',hand,vertices=8)
        strap('mauser_sling',[(x,.08,1.019),(x,-.35,.985),(x,-.88,1.106)],'leather',hand,.012)
    elif kind=='martini-henry':
        # NAM 1979-07-61-1: solid receiver, short underlever, no magazine,
        # external hammer or flintlock. The under-barrel rod is for cleaning.
        hand=pivot('martini_rifle',(x,-.16,1.158),hand)
        verts=[(x+dx,y,z) for dx in [-.037,.037] for y,z in [(.23,.95),(.22,1.10),(-.08,1.165),(-.115,1.095)]]
        mesh('martini_buttstock',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'wood',hand,False)
        box('martini_receiver',(x,-.16,1.158),(.09,.17,.10),'iron',hand,.006)
        box('martini_breech_block',(x,-.17,1.211),(.057,.095,.015),'dark_metal',hand,.003)
        box('martini_forestock',(x,-.57,1.141),(.057,.65,.058),'wood',hand,.013)
        cylinder('martini_barrel',(x,-.23,1.182),(x,-1.02,1.182),.015,'dark_metal',hand,vertices=16)
        cylinder('martini_muzzle',(x,-1.018,1.182),(x,-1.034,1.182),.017,'iron',hand,vertices=16)
        box('martini_rear_sight',(x,-.31,1.207),(.035,.068,.015),'iron',hand,.003)
        box('martini_front_sight',(x,-.986,1.206),(.012,.035,.025),'iron',hand,.002)
        for y in [-.44,-.9]:
            cylinder('martini_barrel_band',(x,y-.008,1.158),(x,y+.008,1.158),.034,'dark_metal',hand,vertices=16)
        tube('martini_trigger_guard',[(x,-.19,1.108),(x,-.175,1.068),(x,-.13,1.045),(x,-.077,1.06),(x,-.07,1.10)],.007,'iron',hand)
        tube('martini_underlever',[(x,-.112,1.10),(x,-.02,1.045),(x,.035,1.012),(x,.082,1.023),(x,.093,1.057)],.009,'iron',hand)
        cylinder('martini_cocking_indicator',(x+.049,-.16,1.159),(x+.050,-.17,1.194),.007,'steel',hand,vertices=8,radius2=.003)
        cylinder('cleaning_rod',(x,-.37,1.111),(x,-1.03,1.111),.004,'steel',hand,vertices=8)
        strap('rifle_sling',[(x,.09,1.016),(x,-.31,.977),(x,-.90,1.12)],'leather',hand,.012)
        # Socket bayonet is attested in Jenkins' sketch and the Rorke's Drift account.
        cylinder('bayonet_socket',(x,-.97,1.182),(x,-1.04,1.182),.023,'iron',hand,vertices=12)
        tube('bayonet_offset',[(x+.018,-1.035,1.181),(x+.061,-1.066,1.181)],.009,'steel',hand)
        cylinder('socket_bayonet',(x+.061,-1.06,1.181),(x+.061,-1.54,1.181),.013,'steel',hand,vertices=3,radius2=.001)
    elif kind in ['musket','rifle','bolt-rifle','matchlock','flintlock']:
        lock_kind=kind
        kind='rifle' if kind=='bolt-rifle' else 'musket' if kind in ['matchlock','flintlock'] else kind
        box('gun_stock',(x,-.10,1.08),(.07,.34,.11),'wood' if kind=='musket' else 'olive',hand,.022)
        box('gun_forestock',(x,-.42,1.12),(.055,.43,.048),'wood',hand,.012)
        cylinder('gun_barrel',(x,-.08,1.15),(x,-.92 if kind=='musket' else -.79,1.15),.016,'dark_metal',hand)
        cylinder('gun_muzzle',(x,-.89 if kind=='musket' else -.76,1.15),(x,-.94 if kind=='musket' else -.82,1.15),.021,'iron',hand)
        box('gun_lock',(x+.043,-.16,1.13),(.016,.09,.065),'iron',hand,.005)
        ellipse('trigger_guard',(x+.006,-.16,1.032),.025,.047,'iron',hand,radius=.007)
        if kind=='rifle':
            if lock_kind!='bolt-rifle':box('magazine',(x,-.34,1.015),(.045,.09,.15),'dark_metal',hand,.012)
            box('rear_sight',(x,-.2,1.18),(.04,.035,.035),'iron',hand,.005)
            if lock_kind=='bolt-rifle':
                cylinder('bolt_handle',(x+.015,-.11,1.18),(x+.072,-.11,1.14),.009,'iron',hand)
                sphere('bolt_knob',(x+.072,-.11,1.14),(.019,.019,.019),'iron',hand,8,6)
        else:
            cylinder('ramrod',(x+.02,-.21,1.10),(x+.02,-.89,1.10),.005,'iron',hand,vertices=6)
            if lock_kind=='matchlock':
                tube('match_serpentine',[(x+.053,-.11,1.14),(x+.06,-.07,1.22),(x+.06,-.15,1.23)],.009,'iron',hand)
                tube('slow_match',[(x+.06,-.15,1.23),(x+.075,-.19,1.19),(x+.10,-.17,1.12)],.005,'linen',hand)
            elif lock_kind=='flintlock':
                cylinder('flint_cock',(x+.05,-.1,1.13),(x+.06,-.12,1.21),.01,'iron',hand)
                box('flint',(x+.06,-.15,1.205),(.018,.035,.022),'black',hand,.002)
                box('frizzen',(x+.053,-.19,1.19),(.022,.014,.065),'iron',hand,.003)
        for gy in [-.35,-.62]:
            cylinder('barrel_band',(x,gy-.009,1.135),(x,gy+.009,1.135),.032,'bronze' if kind=='musket' else 'iron',hand)
        strap('gun_sling',[(x,-.04,1.03),(x,-.27,.97),(x,-.62,1.08)],par=hand,width=.009)


def human(style='plain', weapon_kind='spear', shield_kind='round', root=None, offset=(0,0,0), name_prefix=''):
    equipment_style=style
    style={'tricorne':'shako','longbow':'neutral','plate':'medieval','british-rifle':'rifle','german-rifle':'rifle','french-rifle':'rifle'}.get(style,style)
    base_objects=set(bpy.context.scene.objects)
    root=root or pivot('unit_root')
    hips=pivot('hips',(0,0,.96),root)
    torso=pivot('torso',(0,0,1.10),hips)
    head=pivot('head',(0,0,1.53),torso)
    cloth='prussian_blue' if style=='prussian-1870' else 'french_capote' if style=='french-1870' else 'russian_greatcoat' if style=='russian-russo-winter' else 'winter_drab' if style=='japanese-russo-winter' else 'white' if style=='austrian-seven-years' else 'red' if style=='zulu-war-british' else 'blue' if style in ['shako','french-revolution','mexican-war'] else 'olive' if style=='rifle' else 'linen' if style=='greek' else 'cloth_dark' if style in ['east','steppe'] else 'cloth'
    arms={};legs={};shins={};hands={};forearms={}
    # Layered tailored silhouette with a pinched waist and pleated skirt hem.
    body_rings('tunic',[(.89,.205,.13,0),(.99,.185,.12,0),(1.11,.17,.11,0),(1.30,.215,.13,0),(1.43,.235,.115,0),(1.49,.18,.09,0)],cloth,torso,24,.018)
    body_rings('tunic_hem',[(.87,.207,.133,0),(.91,.206,.132,0)],'leather' if style not in ['shako','rifle','zulu-war-british','ottoman-ww1','french-revolution','austrian-seven-years','japanese-russo-winter','russian-russo-winter','mexican-war','french-1870','prussian-1870'] else cloth,torso,24,.025)
    body_rings('collar',[(1.445,.075,.065,0),(1.51,.072,.06,0)],'rose' if style=='austrian-seven-years' else 'red' if style in ['shako','french-revolution','mexican-war','prussian-1870'] else cloth,torso)
    cylinder('neck',(0,0,1.48),(0,0,1.57),.063,'skin',head)
    sphere('face',(0,-.01,1.63),(.092,.083,.13),'skin',head)
    sphere('jaw',(0,-.045,1.563),(.075,.062,.054),'skin',head)
    sphere('nose',(0,-.095,1.63),(.02,.029,.037),'skin',head,12,8)
    for sign in [-1,1]:
        sphere('ear',(sign*.093,-.008,1.63),(.015,.022,.031),'skin',head,12,8)
        sphere('eye',(sign*.039,-.087,1.657),(.010,.005,.006),'eye',head,10,6)
        cylinder('eyebrow',(sign*.019,-.087,1.676),(sign*.062,-.077,1.679),.005,'mane',head,vertices=6)
    tube('mouth',[(-.024,-.093,1.585),(0,-.098,1.582),(.024,-.093,1.585)],.003,'leather',head)
    helmet(equipment_style,head)
    if style in ['ottoman','mughal']:
        body_rings('long_coat_skirt',[(.58,.23,.15,0),(.77,.22,.145,0),(.99,.18,.12,0)],cloth,torso,24,.013)
        strap('coat_edge',[(0,-.16,.60),(0,-.16,.85),(0,-.15,1.06),(-.12,-.13,1.39)],'linen',torso,.008)
        cylinder('powder_horn',(.15,-.12,1.02),(.23,-.10,.83),.043,'wood_light',torso,radius2=.009)
    if style=='byzantine':
        body_rings('knee_length_tunic',[(.66,.227,.145,0),(.85,.216,.137,0),(.98,.187,.124,0)],cloth,torso,24,.013)
        tube('tunic_front_hem',[(-.20,-.08,.67),(-.11,-.134,.66),(0,-.147,.66),(.11,-.134,.66),(.20,-.08,.67)],.009,'linen',torso)
    for sign, suffix in [(-1,'l'),(1,'r')]:
        arm=pivot('arm_'+suffix,(sign*.232,0,1.435),torso)
        fore=pivot('forearm_'+suffix,(sign*.305,-.025,1.195),arm)
        hand=pivot('hand_'+suffix,(sign*.33,-.075,1.06),fore)
        arms[suffix]=arm;forearms[suffix]=fore;hands[suffix]=hand
        sphere('sleeve_'+suffix,(sign*.256,0,1.38),(.092,.093,.14),cloth,arm)
        cylinder('upper_arm_'+suffix,(sign*.265,0,1.36),(sign*.303,-.025,1.20),.064,'skin' if style in ['plain','greek','roman','zulu'] else cloth,arm,radius2=.048)
        sphere('elbow_'+suffix,(sign*.305,-.025,1.195),(.053,.052,.055),'skin' if style in ['plain','greek','roman','zulu'] else cloth,fore)
        cylinder('forearm_mesh_'+suffix,(sign*.305,-.025,1.19),(sign*.33,-.075,1.065),.052,'skin' if style in ['plain','greek','roman','zulu'] else cloth,fore,radius2=.038)
        cylinder('wrist_wrap_'+suffix,(sign*.324,-.064,1.095),(sign*.331,-.076,1.059),.042,'rose' if style=='austrian-seven-years' else 'red' if style in ['french-revolution','mexican-war','prussian-1870'] else 'russian_greatcoat' if style=='russian-russo-winter' else 'french_capote' if style=='french-1870' else 'leather',fore)
        sphere('palm_'+suffix,(sign*.33,-.075,1.027),(.042,.035,.065),'russian_greatcoat' if style=='russian-russo-winter' else 'cloth_dark' if style=='japanese-russo-winter' else 'skin',hand)
        for f in range(3):
            cylinder('finger_'+suffix,(sign*.33-.025+f*.018,-.1,1.045),(sign*.33-.025+f*.018,-.103,1.009),.008,'russian_greatcoat' if style=='russian-russo-winter' else 'skin',hand,vertices=6)
        leg=pivot('leg_'+suffix,(sign*.106,0,.96),hips)
        shin=pivot('shin_'+suffix,(sign*.115,0,.55),leg)
        legs[suffix]=leg;shins[suffix]=shin
        legcloth='prussian_grey' if style=='prussian-1870' else 'garance' if style=='french-1870' else 'blue' if style=='zulu-war-british' else 'linen' if style in ['french-revolution','mexican-war'] else cloth
        cylinder('thigh_'+suffix,(sign*.106,0,.94),(sign*.115,0,.55),.093,legcloth,leg,radius2=.061)
        sphere('knee_'+suffix,(sign*.115,-.005,.55),(.065,.065,.068),'black' if style=='austrian-seven-years' else legcloth,shin)
        cylinder('calf_'+suffix,(sign*.115,0,.54),(sign*.115,0,.17),.065,'black' if style=='austrian-seven-years' else 'skin' if style in ['plain','greek','roman','zulu'] else legcloth,shin,radius2=.043)
        bootmat='russian_felt' if style=='russian-russo-winter' else 'black' if style in ['austrian-seven-years','french-1870','prussian-1870'] else 'leather'
        sphere('foot_'+suffix,(sign*.115,-.038,.075),(.062,.13,.070),bootmat,shin)
        box('sole_'+suffix,(sign*.115,-.04,.024),(.127,.247,.026),'russian_felt' if style=='russian-russo-winter' else 'dark_metal',shin,.014)
        if style in ['plain','greek','roman','zulu']:
            for l in range(3):
                z=.13+l*.042
                cylinder('sandal_lacing',(sign*.15,-.037,z),(sign*.08,-.037,z+.031),.007,'leather',shin,vertices=6)
        else:
            short_boot=style in ['byzantine','zulu-war-british','ottoman-ww1','french-revolution','austrian-seven-years','japanese-russo-winter','mexican-war','french-1870','prussian-1870']
            cylinder('boot_shaft',(sign*.115,0,.1),(sign*.115,0,.16 if short_boot else .32),.058,bootmat,shin,radius2=.060 if short_boot else .069)
            if style=='french-1870':cylinder('short_white_gaiter',(sign*.115,0,.145),(sign*.115,0,.29),.060,'white',shin,radius2=.063)
            if style=='japanese-russo-winter':
                cylinder('canvas_leg_wrap',(sign*.115,0,.15),(sign*.115,0,.54),.060,'linen',shin,radius2=.069)
                for row in range(7):tube('canvas_wrap_seam',[(sign*.115+.064*math.cos(t*TAU/16),.065*math.sin(t*TAU/16),.175+row*.047+.017*t/16) for t in range(17)],.0025,'white',shin)
            if style=='austrian-seven-years':
                gaiter=pivot('austrian_gaiters' if suffix=='l' else 'austrian_gaiter_r',(sign*.115,0,.32),shin)
                cylinder('black_cloth_gaiter',(sign*.115,0,.145),(sign*.115,0,.61),.060,'black',gaiter,radius2=.071)
                for h in [.20,.27,.34,.41,.48,.55]:sphere('gaiter_button',(sign*.177,-.013,h),(.006,.005,.006),'black',gaiter,8,4)
            if style=='zulu-war-british':cylinder('short_gaiter',(sign*.115,0,.155),(sign*.115,0,.245),.059,'black',shin,radius2=.061)
            if style=='ottoman-ww1':
                cylinder('cloth_puttee',(sign*.115,0,.155),(sign*.115,0,.45),.059,'cloth_dark',shin,radius2=.067)
                for row in range(7):
                    tube('puttee_wrap',[(sign*.115+.061*math.cos(t*TAU/20),.063*math.sin(t*TAU/20),.177+row*.036+.017*t/20) for t in range(21)],.003,'cloth',shin)
            if style=='russian-russo-winter':cylinder('thick_felt_boot',(sign*.115,0,.13),(sign*.115,0,.52),.073,'russian_felt',shin,vertices=16,radius2=.076)
            for l in range(0 if style in ['austrian-seven-years','russian-russo-winter','prussian-1870'] else 1 if short_boot else 3):
                cylinder('boot_lacing',(sign*.115-.028,-.053,.18+l*.035),(sign*.115+.028,-.053,.20+l*.035),.004,'linen',shin,vertices=6)
    body_rings('belt',[(1.025,.193,.129,0),(1.076,.187,.126,0)],'leather',torso)
    box('belt_buckle',(0,-.139,1.053),(.064,.017,.055),'bronze',torso,.008)
    box('belt_buckle_inset',(0,-.150,1.053),(.039,.009,.031),'leather',torso,.004)
    if style in ['tercio','civil-war-pike']:
        body_rings('pike_cuirass',[(1.07,.191,.143,0),(1.18,.195,.158,0),(1.35,.225,.153,0),(1.44,.19,.117,0)],'iron',torso)
        body_rings('gorget',[(1.425,.153,.110,0),(1.475,.082,.075,0),(1.505,.079,.069,0)],'steel',torso)
        for sign in [-1,1]:
            for row in range(4):
                z=.91+row*.037
                box('tasset_lame',(sign*.105,-.143,z),(.19,.042,.043),'iron',torso,.009)
                for dx in [-.065,.065]:sphere('tasset_rivet',(sign*.105+dx,-.169,z),(.006,.005,.006),'steel',torso,8,4)
            strap('cuirass_shoulder_strap',[(sign*.14,.085,1.42),(sign*.14,0,1.48),(sign*.14,-.105,1.42)],'leather',torso,.021)
            sphere('breeches',(sign*.107,0,.76),(.11,.111,.19),cloth,legs['l' if sign==-1 else 'r'])
        cylinder('sword_scabbard',(-.20,.085,1.04),(-.25,.08,.48),.026,'leather',torso,radius2=.018)
        cylinder('side_sword_grip',(-.199,.085,1.06),(-.19,.084,1.18),.018,'leather',torso)
        cylinder('side_sword_guard',(-.27,.085,1.055),(-.13,.085,1.055),.010,'iron',torso)
        sphere('side_sword_pommel',(-.19,.084,1.19),(.028,.028,.028),'iron',torso)
    elif style=='byzantine':
        strap('sword_baldric',[(.16,-.085,1.44),(0,-.15,1.26),(-.18,-.11,1.05)],'leather',torso,.019)
        cylinder('straight_sword_scabbard',(-.21,.08,1.05),(-.25,.07,.46),.027,'leather',torso,radius2=.018)
        cylinder('straight_sword_grip',(-.21,.08,1.06),(-.20,.08,1.18),.019,'wood',torso)
        cylinder('straight_sword_guard',(-.26,.08,1.055),(-.16,.08,1.055),.012,'iron',torso)
    elif style=='republican':
        strap('pectoral_strap',[(-.16,-.10,1.43),(0,-.146,1.31),(.15,-.123,1.08)],'leather',torso,.020)
        box('bronze_pectorale',(0,-.147,1.31),(.22,.025,.22),'bronze',torso,.018)
        for sign, side in [(-1,'l'),(1,'r')]:sphere('bronze_greave',(sign*.115,-.040,.35),(.066,.040,.17),'bronze',shins[side])
        # Carried pila are shown alongside the shield; the Engage clip uses the sword.
        for pilum_offset in [-.028,.028]:
            px=-.30+pilum_offset
            cylinder('pilum_haft',(px,-.06,.20),(px,-.06,1.22),.012,'wood',hands['l'])
            cylinder('pilum_iron_shank',(px,-.06,1.22),(px,-.06,1.93),.006,'iron',hands['l'],vertices=8)
            blade('pilum_head',(px,-.06,1.93),.075,.012,'iron',hands['l'])
    elif style=='persian':
        body_rings('scale_armour',[(1.08,.194,.14,0),(1.30,.221,.141,0),(1.42,.235,.124,0)],'iron',torso)
        for row in range(7):
            for col in range(10):
                sx=-.19+col*.042+(row%2)*.01
                sy=-.142*math.sqrt(max(.1,1-(sx/.25)**2))-.008
                sphere('iron_scale',(sx,sy,1.105+row*.043),(.021,.01,.027),'iron',torso,8,6)
    elif style=='roman':
        for i in range(6):
            z=1.11+i*.049
            body_rings('articulated_iron_lame',[(z,.185+i*.005,.132,0),(z+.040,.185+(i+1)*.005,.132,0)],'iron',torso)
            for sign in [-1,1]:sphere('armour_rivet',(sign*.08,-.134,z+.018),(.008,.006,.008),'bronze',torso,8,4)
        for sign in [-1,1]:
            for i in range(3):sphere('shoulder_lame',(sign*(.17+i*.033),0,1.455-i*.020),(.08,.105,.03),'iron',arms['l' if sign==-1 else 'r'])
        for sign in [-2,-1,0,1,2]:
            box('apron_strip',(sign*.035,-.137,.956),(.026,.022,.19),'leather',torso,.008)
            for z in [.9,.95,1.0]:sphere('apron_stud',(sign*.035,-.151,z),(.006,.005,.006),'bronze',torso,8,4)
    elif style=='greek':
        sphere('bronze_breastplate',(0,-.003,1.305),(.221,.153,.192),'bronze',torso)
        for sign in [-1,1]:sphere('cuirass_chest',(sign*.09,-.133,1.365),(.091,.034,.083),'bronze',torso)
        for sign in [-1,1]:
            shin=shins['l' if sign==-1 else 'r']
            sphere('bronze_greave',(sign*.115,-.035,.34),(.066,.044,.175),'bronze',shin)
    elif style in ['east','steppe']:
        for row in range(7):
            z=1.12+row*.042
            for col in range(9):
                angle=math.pi+math.pi*col/8
                x=.204*math.cos(angle);y=.137*math.sin(angle)-.012
                plate=box('lamellar_plate',(x,y,z),(.041,.022,.037),'iron',torso,.004)
                plate.rotation_euler[2]=angle+math.pi/2
        for sign in [-1,1]:
            for j in range(3):sphere('lamellar_shoulder',(sign*(.205+j*.025),0,1.445-j*.033),(.076,.098,.02),'iron',arms['l' if sign==-1 else 'r'])
    elif equipment_style=='plate':
        body_rings('mail_skirt',[(.83,.22,.14,0),(1.12,.19,.13,0)],'iron',torso)
        sphere('plate_breastplate',(0,-.012,1.29),(.222,.15,.205),'steel',torso)
        for sign, side in [(-1,'l'),(1,'r')]:
            sphere('plate_shoulder',(sign*.245,0,1.42),(.093,.107,.082),'steel',arms[side])
            cylinder('vambrace',(sign*.305,-.025,1.19),(sign*.33,-.075,1.10),.057,'steel',forearms[side],radius2=.045)
            sphere('poleyn',(sign*.115,-.025,.55),(.077,.075,.069),'steel',shins[side])
            cylinder('greave',(sign*.115,0,.50),(sign*.115,0,.18),.068,'steel',shins[side],radius2=.049)
    elif style=='medieval':
        # Mail silhouette and short woven highlights, never late plate armour for 1066.
        body_rings('mail_hauberk',[(.94,.209,.143,0),(1.1,.194,.139,0),(1.30,.222,.143,0),(1.45,.231,.118,0)],'iron',torso)
        for row in range(16):
            z=.97+row*.027
            for col in range(10):
                x=-.18+col*.04+(row%2)*.008
                y=-.145*math.sqrt(max(.1,1-(x/.235)**2))-.006
                cylinder('mail_link_highlight',(x-.010,y,z),(x+.008,y,z+.007),.0025,'steel',torso,vertices=5)
        for sign in [-1,1]:
            sphere('mail_shoulder',(sign*.235,0,1.42),(.09,.1,.085),'iron',arms['l' if sign==-1 else 'r'])
    elif style=='prussian-1870':
        # Carnavalet campaign print's "Soldat de la ligne": blue tunic,
        # red collar/cuffs, grey trousers and light leather carrying straps.
        # This is one depicted component; no guard braid or regiment number.
        coat=pivot('prussian_blue_waffenrock',(0,0,1.10),torso)
        body_rings('blue_short_skirts',[(.83,.216,.14,0),(.96,.198,.13,0),(1.05,.185,.128,0)],'prussian_blue',coat,20)
        tube('red_front_piping',[(0,-.144,.835),(0,-.137,1.03),(0,-.13,1.13),(0,-.15,1.30),(0,-.125,1.445)],.003,'red',coat)
        for wz in [.875,.95,1.10,1.168,1.237,1.306,1.375,1.432]:
            sphere('line_tunic_button',(.014,-.145,wz),(.007,.005,.007),'bronze',coat,8,4)
        body_rings('light_leather_waistbelt',[(1.029,.203,.145,0),(1.074,.198,.141,0)],'white',coat,20)
        box('plain_brass_buckle',(0,-.151,1.052),(.06,.013,.042),'bronze',coat,.002)
        strap('light_cartridge_baldric',[(.144,-.097,1.46),(.037,-.16,1.29),(-.183,-.135,1.021)],'white',coat,.02)
        box('line_cartridge_box',(-.16,-.166,.969),(.142,.065,.135),'black',coat,.007)
        box('cartridge_box_flap',(-.16,-.204,1.002),(.15,.011,.06),'black',coat,.004)
        box('line_knapsack',(0,.186,1.29),(.277,.129,.29),'leather',coat,.012)
        cylinder('rolled_campaign_cloth',(-.166,.20,1.47),(.166,.20,1.47),.065,'prussian_grey',coat,vertices=16)
        for sign in [-1,1]:
            strap('light_knapsack_strap',[(sign*.105,.222,1.42),(sign*.137,.031,1.478),(sign*.169,-.095,1.382),(sign*.164,-.139,1.06)],'white',coat,.012)
            strap('knapsack_roll_tie',[(sign*.109,.143,1.43),(sign*.109,.139,1.49),(sign*.109,.214,1.535),(sign*.109,.263,1.47)],'black',coat,.009)
            cylinder('trouser_red_piping',(sign*.207,0,.88),(sign*.178,0,.56),.003,'red',legs['l' if sign==-1 else 'r'],vertices=6)
            cylinder('trouser_lower_piping',(sign*.178,0,.54),(sign*.160,0,.18),.003,'red',shins['l' if sign==-1 else 'r'],vertices=6)
    elif style=='french-1870':
        # Museum Guerre et Paix explicitly describes the 1870 capote.
        # Campaign skirts are turned back to expose the garance trousers;
        # no regiment number, NCO stripes or elite-company epaulettes.
        coat=pivot('french_1870_capote',(0,0,1.10),torso)
        for sign in [-1,1]:
            mesh('capote_back_skirt',[(sign*.010,.144,.52),(sign*.246,.105,.55),(sign*.216,.13,.96),(sign*.012,.146,1.07)],[(0,1,2,3)],'french_capote',coat,False)
            mesh('capote_turned_front_skirt',[(sign*.19,-.106,.57),(sign*.26,-.06,.59),(sign*.213,-.124,1.045),(sign*.020,-.153,1.03)],[(0,1,2,3)],'french_capote',coat,False)
            tube('turned_skirt_fold',[(sign*.19,-.107,.57),(sign*.08,-.139,.91),(sign*.020,-.154,1.03)],.003,'blue',coat)
            for wz in [1.125,1.192,1.259,1.326,1.393]:
                sphere('plain_capote_button',(sign*.048,-.145,wz),(.007,.005,.007),'bronze',coat,8,4)
        body_rings('black_infantry_waistbelt',[(1.027,.201,.145,0),(1.068,.196,.142,0)],'black',coat,20)
        box('plain_infantry_buckle',(0,-.148,1.047),(.061,.01,.039),'bronze',coat,.002)
        strap('black_cartridge_baldric',[(-.155,-.098,1.46),(-.029,-.16,1.28),(.19,-.128,1.015)],'black',coat,.023)
        box('black_cartridge_box',(.18,.144,1.015),(.17,.074,.14),'black',coat,.007)
        box('campaign_knapsack',(0,.188,1.28),(.285,.13,.29),'leather',coat,.015)
        for sign in [-1,1]:strap('knapsack_shoulder_strap',[(sign*.13,.219,1.4),(sign*.145,.045,1.475),(sign*.17,-.085,1.39),(sign*.165,-.145,1.065)],'black',coat,.012)
        cylinder('empty_sabre_scabbard',(-.215,.050,1.018),(-.246,.065,.37),.020,'dark_metal',coat,vertices=10,radius2=.011)
    elif style=='russian-russo-winter':
        # US observers pp.18–19: grey-brown coat to mid-calf, optional
        # camel-hair bashlyk down; no regimental number or officer insignia.
        coat=pivot('russian_winter_greatcoat',(0,0,1.05),torso)
        body_rings('long_grey_brown_greatcoat',[(.38,.267,.171,0),(.63,.249,.164,0),(.90,.221,.149,0),(1.08,.193,.132,0),(1.32,.228,.144,0),(1.46,.239,.119,0)],'russian_greatcoat',coat,20,.019)
        body_rings('plain_cloth_greatcoat_collar',[(1.44,.130,.090,0),(1.505,.094,.075,0)],'russian_greatcoat',coat,16)
        tube('greatcoat_front_overlap',[(.038,-.17,.39),(.038,-.163,.66),(.038,-.149,.92),(.038,-.136,1.08),(.038,-.146,1.30),(.038,-.115,1.44)],.004,'russian_felt',coat)
        body_rings('greatcoat_waistbelt',[(1.025,.212,.150,0),(1.074,.203,.148,0)],'leather',coat,20)
        # Folded-down hood and tails are one attested winter arrangement,
        # not an assertion that every infantryman wore this combination.
        mesh('folded_bashlyk_hood',[(-.14,.10,1.46),(.14,.10,1.46),(.16,.168,1.37),(0,.214,1.18),(-.16,.168,1.37)],[(0,1,2,3,4)],'winter_drab',coat,False)
        for sign in [-1,1]:
            mesh('bashlyk_tail',[(sign*.12,-.098,1.46),(sign*.18,-.09,1.45),(sign*.113,-.157,1.06),(sign*.06,-.162,1.06)],[(0,1,2,3)],'winter_drab',coat,False)
            box('russian_cartridge_pouch',(sign*.138,-.16,1.077),(.112,.067,.101),'leather',coat,.007)
            box('russian_cartridge_flap',(sign*.138,-.198,1.112),(.116,.011,.040),'leather',coat,.004)
        box('plain_russian_belt_buckle',(0,-.166,1.05),(.061,.012,.046),'iron',coat,.003)
    elif style=='japanese-russo-winter':
        # US observer report (1906), p.19: ample drab wool winter overcoat,
        # fur collar and canvas leg wrappings. This is an explicit seasonal
        # variant, not evidence for khaki dress throughout the war.
        coat=pivot('japanese_winter_overcoat',(0,0,1.05),torso)
        body_rings('ample_winter_coat',[(.56,.247,.158,0),(.75,.225,.151,0),(.97,.203,.14,0),(1.08,.182,.127,0),(1.30,.224,.145,0),(1.43,.240,.127,0)],'winter_drab',coat,20,.025)
        body_rings('winter_fur_collar',[(1.424,.155,.122,0),(1.50,.103,.085,0),(1.535,.085,.076,0)],'cloth_dark',coat,20,.055)
        tube('overcoat_front_overlap',[(.04,-.160,.57),(.04,-.154,.82),(.04,-.144,1.02),(.04,-.15,1.28),(.04,-.12,1.42)],.004,'cloth_dark',coat)
        body_rings('winter_coat_waistbelt',[(1.025,.210,.148,0),(1.074,.20,.146,0)],'leather',coat,20)
        for sign in [-1,1]:
            box('winter_cartridge_pouch',(sign*.13,-.158,1.076),(.10,.066,.106),'leather',coat,.009)
            box('winter_cartridge_flap',(sign*.13,-.196,1.111),(.104,.012,.044),'leather',coat,.004)
        box('plain_winter_belt_buckle',(0,-.161,1.05),(.059,.014,.044),'iron',coat,.004)
        cylinder('empty_bayonet_scabbard',(-.217,.035,1.02),(-.259,.035,.61),.020,'dark_metal',coat,radius2=.013)
    elif style=='mexican-war':
        # Blue/red and canvas-trouser component; no universal uniform claim.
        coat=pivot('mexican_tailcoat',(0,0,1.12),torso)
        for z in [1.13,1.19,1.25,1.31,1.37]:sphere('plain_coat_button',(0,-.143,z),(.008,.005,.008),'bronze',coat,8,4)
        for sign in [-1,1]:
            mesh('mexican_blue_coat_tail',[(sign*.02,.137,.64),(sign*.175,.11,.66),(sign*.184,.106,1.02),(sign*.021,.138,1.02)],[(0,1,2,3)],'blue',coat,False)
            mesh('red_tail_turnback',[(sign*.02,.144,.64),(sign*.16,.12,.675),(sign*.021,.145,.92)],[(0,1,2)],'red',coat,False)
            strap('white_crossbelt',[(sign*.16,-.092,1.46),(0,-.158,1.27),(-sign*.17,-.14,1.04)],'white',coat,.022)
            cuff=forearms['l' if sign==-1 else 'r']
            cylinder('red_cloth_cuff',(sign*.319,-.055,1.126),(sign*.331,-.075,1.063),.053,'red',cuff,vertices=16,radius2=.044)
        box('cartridge_box',(.17,.15,.97),(.17,.076,.14),'black',coat,.009)
        cylinder('empty_bayonet_scabbard',(-.21,.04,1.0),(-.26,.04,.57),.019,'black',coat,radius2=.011)
    elif style=='austrian-seven-years':
        # White coat and rose regimental facings from Ligne 1762. Facings
        # vary between regiments; this is one representative fusilier component.
        mesh('white_waistcoat',[(-.13,-.14,.84),(.13,-.14,.84),(.09,-.144,1.28),(-.09,-.144,1.28)],[(0,1,2,3)],'white',torso,False)
        body_rings('white_waistbelt',[(1.028,.196,.132,0),(1.069,.192,.129,0)],'white',torso)
        for sign in [-1,1]:
            mesh('rose_lapel',[(sign*.031,-.149,1.08),(sign*.102,-.142,1.08),(sign*.157,-.118,1.40),(sign*.126,-.105,1.464),(sign*.036,-.119,1.405)],[(0,1,2,3,4)],'rose',torso,False)
            for i in range(7):sphere('lapel_button',(sign*(.066+i*.010),-.154+i*.007,1.12+i*.044),(.007,.005,.007),'steel',torso,8,4)
            mesh('long_white_coat_skirt',[(sign*.032,.137,.60),(sign*.195,.105,.63),(sign*.195,.09,1.04),(sign*.02,.138,1.04)],[(0,1,2,3)],'white',torso,False)
            mesh('white_front_skirt',[(sign*.14,-.097,.62),(sign*.225,-.065,.66),(sign*.196,-.10,1.01),(sign*.155,-.133,.98)],[(0,1,2,3)],'white',torso,False)
            cuff=forearms['l' if sign==-1 else 'r']
            cylinder('broad_rose_cuff',(sign*.314,-.047,1.15),(sign*.332,-.075,1.06),.062,'rose',cuff,vertices=16,radius2=.052)
        strap('cartridge_box_baldric',[(-.15,-.095,1.45),(-.03,-.155,1.28),(.19,-.107,.98)],'white',torso,.027)
        box('plain_cartridge_box',(.19,.12,.98),(.16,.074,.14),'black',torso,.009)
        cylinder('sidearm_scabbard',(-.20,.085,1.01),(-.24,.08,.55),.018,'black',torso,radius2=.012)
    elif style=='french-revolution':
        # Blue coat, white lapels and red facings: D.9065 and the surviving
        # 8th Infantry coat dated 1800-1805. Not a universal army uniform.
        mesh('white_waistcoat',[(-.13,-.135,.88),(.13,-.135,.88),(.08,-.144,1.24),(-.08,-.144,1.24)],[(0,1,2,3)],'white',torso,False)
        for sign in [-1,1]:
            points=[(sign*x,y,z) for x,y,z in [(.025,-.145,1.13),(.145,-.119,1.37),(.139,-.102,1.47),(.051,-.109,1.43)]]
            mesh('angular_white_lapel',points,[(0,1,2,3)],'white',torso,False)
            for i in range(4):
                sphere('lapel_button',(sign*(.047+i*.024),-.147+i*.008,1.16+i*.071),(.006,.005,.006),'bronze',torso,8,4)
            mesh('coat_tail',[(sign*.018,.132,.68),(sign*.17,.11,.69),(sign*.185,.105,1.02),(sign*.02,.134,1.02)],[(0,1,2,3)],'blue',torso,False)
            mesh('white_tail_turnback',[(sign*.018,.14,.68),(sign*.16,.121,.7),(sign*.02,.142,.96)],[(0,1,2)],'white',torso,False)
            strap('white_crossbelt',[(sign*.16,-.092,1.46),(0,-.160,1.27),(-sign*.15,-.146,1.06)],'white',torso,.020)
        box('cartridge_box',(.135,.168,1.00),(.18,.075,.14),'black',torso,.008)
    elif style=='ottoman-ww1':
        # A plain field tunic is a representative component, not a universal
        # uniform: A02598 and C00636 show different coats, shirts and headwear.
        for z in [1.14,1.20,1.26,1.32,1.38]:sphere('field_tunic_button',(0,-.14,z),(.008,.006,.008),'cloth_dark',torso,8,4)
        for sign in [-1,1]:
            box('leather_cartridge_pouch',(sign*.12,-.151,1.09),(.10,.066,.108),'leather',torso,.012)
            box('cartridge_pouch_flap',(sign*.12,-.190,1.119),(.106,.014,.046),'leather',torso,.006)
    elif style=='zulu-war-british':
        for z in [1.14,1.20,1.26,1.32,1.38]:sphere('tunic_button',(0,-.139,z),(.009,.006,.009),'bronze',torso,8,4)
        body_rings('white_waistbelt',[(1.027,.196,.133,0),(1.074,.191,.131,0)],'white',torso)
        for sign in [-1,1]:
            strap('equipment_shoulder_strap',[(sign*.13,.11,1.08),(sign*.17,.045,1.47),(sign*.16,-.087,1.45),(sign*.10,-.152,1.075)],'white',torso,.021)
            box('cartridge_pouch',(sign*.119,-.158,1.065),(.111,.056,.102),'leather',torso,.014)
            box('cartridge_pouch_flap',(sign*.119,-.193,1.094),(.119,.014,.053),'leather',torso,.008)
        box('belt_buckle_front',(0,-.151,1.052),(.05,.017,.043),'bronze',torso,.005)
    elif style=='shako':
        for z in [1.14,1.2,1.26,1.32,1.38]:sphere('coat_button',(0,-.137,z),(.009,.006,.009),'bronze',torso,8,4)
        strap('white_crossbelt',[(-.16,-.085,1.45),(0,-.153,1.26),(.15,-.137,1.06)],'white',torso,.022)
        strap('second_crossbelt',[(.16,-.085,1.45),(0,-.154,1.26),(-.15,-.137,1.06)],'white',torso,.022)
        for sign in [-1,1]:sphere('epaulette',(sign*.223,0,1.47),(.10,.072,.027),'red',arms['l' if sign==-1 else 'r'])
    elif style=='rifle':
        box('field_pack',(0,.165,1.285),(.27,.15,.27),'olive',torso,.045)
        for sign in [-1,1]:
            strap('webbing',[(sign*.15,.17,1.4),(sign*.18,-.075,1.47),(sign*.16,-.152,1.15)],'leather',torso,.021)
            for z in [1.12,1.245]:box('ammunition_pouch',(sign*.12,-.151,z),(.09,.075,.10),'olive',torso,.009)
        cylinder('canteen',( .19,.06,1.0),(.19,.06,1.14),.065,'dark_metal',torso)
    else:
        strap('shoulder_baldric',[(-.16,-.08,1.45),(0,-.148,1.27),(.15,-.132,1.06)],par=torso,width=.023)
    box('belt_pouch',(-.16,.03,1.04),(.09,.085,.12),'leather',torso,.025)
    if weapon_kind in ['bow','longbow']:
        cylinder('quiver',(-.10,.15,1.06),(-.12,.16,1.43),.055,'leather',torso)
        for i in range(4):
            x=-.16+i*.022
            cylinder('spare_arrow',(x,.16,1.20),(x,.16,1.58),.004,'wood_light',torso,vertices=5)
            box('arrow_fletching',(x,.16,1.53),(.014,.022,.055),'linen',torso,.002)
    if style=='neutral':
        # Unclassified equipment: an unarmed, plainly clothed scale figure.
        pass
    if shield_kind:shield(shield_kind,hands['l'])
    weapon(weapon_kind,hands['r'])
    created=set(bpy.context.scene.objects)-base_objects
    if offset != (0,0,0):
        # Apply offset through a common parent to preserve joint-local transforms.
        rider=pivot(name_prefix+'rider_offset',offset,root)
        parent(hips,rider)
        hips.location += Vector(offset)
    if name_prefix:
        for ob in created:
            if ob!=root:ob.name=name_prefix+ob.name
    return {'root':root,'hips':hips,'torso':torso,'head':head,'arms':arms,'forearms':forearms,'hands':hands,'legs':legs,'shins':shins,'weapon_kind':weapon_kind}


def animate_node(obj, clip, poses, frames=25):
    if obj.animation_data is None:obj.animation_data_create()
    obj.animation_data.action=None
    base_location=obj.location.copy();base_rotation=obj.rotation_euler.copy()
    for fraction, delta_rot, delta_pos in poses:
        obj.rotation_euler=Vector(base_rotation)+Vector(delta_rot)
        obj.location=base_location+Vector(delta_pos)
        frame=1+round(fraction*(frames-1))
        obj.keyframe_insert(data_path='rotation_euler',frame=frame)
        obj.keyframe_insert(data_path='location',frame=frame)
    action=obj.animation_data.action
    action.name=f'{obj.name}_{clip}'
    obj.animation_data.action=None
    track=obj.animation_data.nla_tracks.new();track.name=clip
    strip=track.strips.new(clip,1,action)
    strip.extrapolation='HOLD'
    obj.location=base_location;obj.rotation_euler=base_rotation


def humanoid_animations(rig, mounted=False):
    for side, sign in [('l',1),('r',-1)]:
        animate_node(rig['legs'][side],'March',[(t,(0 if mounted else sign*.37*math.cos(t*TAU),0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
        animate_node(rig['shins'][side],'March',[(t,(0 if mounted else max(0,-sign*math.sin(t*TAU))*.55,0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
        animate_node(rig['arms'][side],'March',[(t,(-sign*.14*math.cos(t*TAU),0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
    animate_node(rig['hips'],'March',[(t,(0,0,math.sin(t*TAU)*.018),(0,0,.013*(1-math.cos(t*TAU*2)))) for t in [0,.125,.25,.375,.5,.625,.75,.875,1]])
    if rig['weapon_kind']=='pike':
        # A long pike is levelled forward, never swept through a sword strike.
        grip=bpy.data.objects['pike_grip']
        # Each clip owns the grip so the exporter/Three mixer cannot retain the
        # levelled engagement transform when switching back to marching.
        animate_node(grip,'March',[(t,(.015*math.sin(t*TAU),0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
        animate_node(rig['arms']['r'],'Engage',[(0,(0,0,0),(0,0,0)),(.55,(.008,0,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
        animate_node(grip,'Engage',[(0,(1.50,0,0),(0,0,0)),(.35,(1.52,0,0),(0,-.05,0)),(.55,(1.53,0,0),(0,-.14,0)),(1,(1.50,0,0),(0,0,0))],30)
        animate_node(rig['torso'],'Engage',[(0,(0,0,0),(0,0,0)),(.55,(.025,0,0),(0,-.04,0)),(1,(0,0,0),(0,0,0))],30)
        return
    if rig['weapon_kind'] in ['musket','rifle','bolt-rifle','matchlock','flintlock','martini-henry','mauser-1893','french-1777','austrian-flintlock','india-pattern','chassepot-1866','dreyse-1862','type30','mosin-1891','crossbow']:
        # Shoulder recoil replaces the sword-swing clip for a firearm or crossbow.
        animate_node(rig['torso'],'Engage',[(0,(0,0,0),(0,0,0)),(.35,(0,0,0),(0,0,0)),(.42,(-.035,0,0),(0,.028,0)),(.75,(0,0,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
        animate_node(rig['arms']['r'],'Engage',[(0,(-.07,0,0),(0,0,0)),(.35,(-.07,0,0),(0,0,0)),(.42,(-.11,0,0),(0,.018,0)),(.75,(-.07,0,0),(0,0,0)),(1,(-.07,0,0),(0,0,0))],30)
        animate_node(rig['forearms']['r'],'Engage',[(0,(0,0,0),(0,0,0)),(.42,(-.05,0,0),(0,0,0)),(.75,(0,0,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
        return
    if rig['weapon_kind'] in ['bow','longbow']:
        animate_node(rig['torso'],'Engage',[(0,(0,0,0),(0,0,0)),(.5,(0,0,-.06),(0,0,0)),(.6,(0,0,-.015),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
        animate_node(rig['arms']['r'],'Engage',[(0,(-.10,0,0),(0,0,0)),(.5,(-.16,0,.04),(0,0,0)),(.6,(-.11,0,0),(0,0,0)),(1,(-.10,0,0),(0,0,0))],30)
        animate_node(rig['arms']['l'],'Engage',[(0,(-.40,0,-.15),(0,0,0)),(.5,(-.62,0,-.32),(0,.04,0)),(.6,(-.40,0,-.15),(0,0,0)),(1,(-.40,0,-.15),(0,0,0))],30)
        return
    animate_node(rig['torso'],'Engage',[(0,(0,0,0),(0,0,0)),(.35,(.07,0,-.08),(0,-.015,0)),(.6,(.10,0,.07),(0,-.04,-.018)),(1,(0,0,0),(0,0,0))],30)
    animate_node(rig['arms']['r'],'Engage',[(0,(-.08,0,0),(0,0,0)),(.3,(-.32,-.07,-.10),(0,0,0)),(.55,(.60,.06,.04),(0,0,0)),(1,(-.08,0,0),(0,0,0))],30)
    animate_node(rig['forearms']['r'],'Engage',[(0,(0,0,0),(0,0,0)),(.3,(-.25,0,0),(0,0,0)),(.55,(.10,0,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
    animate_node(rig['arms']['l'],'Engage',[(0,(0,0,0),(0,0,0)),(.4,(.14,0,-.035),(0,0,0)),(1,(0,0,0),(0,0,0))],30)


def render_preview(filepath):
    # Studio geometry is generated only for this image and removed before exporting.
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    originals=set(bpy.context.scene.objects)
    corners=[ob.matrix_world @ Vector(corner) for ob in originals if ob.type=='MESH' for corner in ob.bound_box]
    lower=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    upper=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    target=(lower+upper)/2;extent=max(upper-lower)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lower.z-.012))
    floor=bpy.context.object;floor.data.materials.append(material('studio_floor',(.065,.075,.079)))
    bpy.ops.object.camera_add(location=target+Vector((1.5,-2.4,1.10))*extent)
    camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=extent*1.44
    bpy.context.scene.camera=camera
    for pos,power,size in [((2,-3,5),700,4),((-3,-1,3),450,3),((0,3,4),900,2)]:
        pos=target+Vector(pos)*(extent/2);power*= (extent/2)**2;size*=extent/2
        bpy.ops.object.light_add(type='AREA',location=pos)
        lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
        lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.render.resolution_x=768;scene.render.resolution_y=896;scene.render.resolution_percentage=100
    scene.world.color=(.18,.18,.18)
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(filepath)
    scene.view_settings.view_transform='AgX'
    bpy.ops.render.render(write_still=True)
    for obj in set(scene.objects)-originals:bpy.data.objects.remove(obj,do_unlink=True)


def inspect_glb(path):
    data=path.read_bytes();length,kind=struct.unpack_from('<II',data,12)
    doc=json.loads(data[20:20+length])
    return {'file':path.name,'bytes':len(data),'meshes':len(doc.get('meshes',[])), 'nodes':len(doc.get('nodes',[])),
            'animations':[a.get('name') for a in doc.get('animations',[])],
            'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'])}


def merge_static_parts():
    # Keep every joint pivot; merge its rigid detail into one mesh with material slots.
    groups={}
    for ob in list(bpy.context.scene.objects):
        if ob.type=='MESH':groups.setdefault(ob.parent,[]).append(ob)
    for par, objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        objects[0].name=(par.name if par else 'unit')+'_geometry'


def export(name):
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='SELECT')
    merge_static_parts()
    path=OUTPUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,
        export_force_sampling=True,export_cameras=False,export_lights=False,export_extras=False,
        export_materials='EXPORT',export_optimize_animation_size=True)
    result=inspect_glb(path)
    print('ASSET',json.dumps(result))
    if set(result['animations'])!={'March','Engage'}:raise RuntimeError(f'Unexpected animation clips: {result}')
    return result


def horse():
    root=pivot('horse_root')
    sphere('horse_barrel',(0,.13,1.16),(.30,.77,.38),'horse',root,24,14)
    sphere('horse_haunches',(0,.63,1.18),(.31,.36,.34),'horse',root)
    sphere('horse_chest',(0,-.44,1.23),(.30,.36,.40),'horse',root)
    neck=sphere('horse_neck',(0,-.67,1.59),(.22,.25,.49),'horse',root)
    neck.rotation_euler[0]=-.40
    skull=sphere('horse_skull',(0,-.91,1.94),(.16,.24,.22),'horse',root)
    muzzle=sphere('horse_muzzle',(0,-1.11,1.81),(.12,.24,.125),'horse',root)
    muzzle.rotation_euler[0]=.34
    for side in [-1,1]:
        sphere('nostril',(side*.09,-1.29,1.815),(.029,.026,.018),'black',root,12,8)
        sphere('horse_eye',(side*.139,-.965,1.967),(.023,.029,.021),'eye',root,12,8)
        ear=sphere('horse_ear',(side*.092,-.83,2.12),(.049,.057,.13),'horse',root)
        ear.rotation_euler[0]=-.21;ear.rotation_euler[1]=side*.18
        sphere('inner_ear',(side*.094,-.87,2.14),(.020,.013,.064),'mane',root)
        tube('bridle_cheek',[(side*.14,-.78,2.02),(side*.16,-.99,1.91),(side*.115,-1.20,1.79)],.017,'leather',root)
        cylinder('bit_ring',(side*.13,-1.16,1.80),(side*.16,-1.16,1.80),.032,'bronze',root)
        tube('reins',[(side*.15,-1.17,1.80),(side*.23,-.77,1.62),(side*.18,-.16,1.83)],.010,'leather',root)
    tube('noseband',[(-.12,-1.19,1.88),(0,-1.275,1.915),(.12,-1.19,1.88)],.020,'leather',root)
    for i in range(12):
        y=-.86+i*.053;z=2.02-i*.040
        mane=sphere('mane_lock',(0,y,z),(.061,.072,.15),'mane',root,12,8)
        mane.rotation_euler[0]=-.43
    tube('tail',[(0,.82,1.24),(0,1.04,1.16),(0,1.14,.83),(0,1.18,.51)],.057,'mane',root)
    for x in [-.034,0,.034]:tube('tail_hair',[(x,1.12,.83),(x,1.21,.48),(x,1.24,.39)],.019,'mane',root)
    # Saddle blanket with bent sides, raised leather saddle and cinch.
    mesh('saddle_blanket',[(-.35,-.2,1.20),(-.25,-.2,1.5),(.25,-.2,1.5),(.35,-.2,1.2),(-.35,.38,1.20),(-.25,.38,1.49),(.25,.38,1.49),(.35,.38,1.2)],[(0,1,5,4),(1,2,6,5),(2,3,7,6)],'red',root)
    sphere('leather_saddle',(0,.04,1.51),(.22,.30,.075),'leather',root)
    for y in [-.22,.28]:cylinder('saddle_bow',(-.20,y,1.50),(.20,y,1.50),.055,'leather',root)
    tube('girth',[(-.29,-.03,1.42),(-.31,-.03,1.03),(0,-.03,.85),(.31,-.03,1.03),(.29,-.03,1.42)],.021,'leather',root)
    legs=[]
    for front,y in [(True,-.48),(False,.62)]:
        for side in [-1,1]:
            x=side*.19;label=('front' if front else 'hind')+('_l' if side<0 else '_r')
            leg=pivot('horse_leg_'+label,(x,y,1.2),root)
            knee=pivot('horse_knee_'+label,(x,y+(.07 if front else -.13),.62),leg)
            sphere('horse_thigh',(x,y,1.10),(.11,.15,.25),'horse',leg)
            cylinder('horse_upper_leg',(x,y,1.06),(x,y+(.07 if front else -.13),.63),.074,'horse',leg,radius2=.047)
            sphere('horse_knee',(x,y+(.07 if front else -.13),.62),(.061,.07,.079),'horse',knee)
            cylinder('horse_lower_leg',(x,y+(.07 if front else -.13),.60),(x,y-.01,.14),.041,'horse',knee,radius2=.031)
            sphere('fetlock',(x,y-.01,.17),(.052,.055,.071),'horse',knee)
            box('hoof',(x,y-.055,.055),(.113,.155,.105),'dark_metal',knee,.038)
            legs.append((leg,knee,(1 if front else -1)*side))
    return root,legs


def horse_animations(root,legs):
    for leg,knee,phase in legs:
        animate_node(leg,'March',[(t,(phase*.23*math.cos(t*TAU),0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
        animate_node(knee,'March',[(t,(max(0,phase*math.sin(t*TAU))*.45,0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
    animate_node(root,'March',[(t,(0,0,0),(0,0,.015*(1-math.cos(t*TAU*2)))) for t in [0,.25,.5,.75,1]])
    animate_node(root,'Engage',[(0,(0,0,0),(0,0,0)),(.5,(.03,0,.018),(0,-.035,.025)),(1,(0,0,0),(0,0,0))],30)


def mounted(archer=False):
    root,legs=horse();root.name='unit_root'
    rig=human('steppe' if archer else 'medieval','bow' if archer else 'spear',None if archer else 'medieval',root,(0,0,.66),'rider_')
    for side,sign in [('l',-1),('r',1)]:
        rig['legs'][side].rotation_euler[1]=-sign*.40
        rig['legs'][side].rotation_euler[0]=-.32
        rig['shins'][side].rotation_euler[0]=.68
    horse_animations(root,legs);humanoid_animations(rig,mounted=True)
    return root


def spoked_wheel(name,pos,radius,par,mat='wood'):
    x,y,z=pos
    wheel=pivot(name,pos,par)
    tube(name+'_rim',[(x,y+radius*math.cos(TAU*i/32),z+radius*math.sin(TAU*i/32)) for i in range(32)],.04,mat,wheel,True)
    tube(name+'_iron_tyre',[(x,y+radius*math.cos(TAU*i/32),z+radius*math.sin(TAU*i/32)) for i in range(32)],.011,'iron',wheel,True)
    cylinder('wheel_hub',(x-.07,y,z),(x+.07,y,z),.067,'iron',wheel)
    for i in range(10):
        angle=TAU*i/10
        cylinder('wheel_spoke',(x,y,z),(x,y+radius*.94*math.cos(angle),z+radius*.94*math.sin(angle)),.018,mat,wheel)
    return wheel


def wheel_animation(wheel):
    animate_node(wheel,'March',[(t,(-t*TAU,0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])


def cannon():
    root=pivot('unit_root')
    wheels=[]
    for side in [-1,1]:wheels.append(spoked_wheel('carriage_wheel',(side*.63,0,.54),.51,root))
    cylinder('axle',(-.73,0,.54),(.73,0,.54),.058,'iron',root)
    for side in [-1,1]:
        beam=box('carriage_cheek',(side*.20,.23,.65),(.12,1.17,.25),'wood',root,.04)
        beam.rotation_euler[0]=.15
        trail=box('trail',(side*.10,.78,.31),(.15,1.17,.14),'wood',root,.035)
        trail.rotation_euler[0]=-.27
    gun=pivot('gun',(0,-.05,.86),root)
    cylinder('bronze_barrel',(0,.42,.84),(0,-1.18,.95),.14,'bronze',gun,radius2=.086,vertices=24)
    cylinder('muzzle_ring',(0,-1.13,.947),(0,-1.24,.957),.116,'bronze',gun,vertices=24)
    cylinder('muzzle_bore',(0,-1.24,.957),(0,-1.245,.958),.065,'black',gun,vertices=24)
    sphere('breech',(0,.43,.84),(.15,.11,.15),'bronze',gun)
    sphere('cascabel',(0,.61,.82),(.071,.094,.071),'bronze',gun)
    for y in [.23,-.5]:cylinder('barrel_band',(0,y-.025,.86-y*.067),(0,y+.025,.86-y*.067),.145 if y>0 else .116,'bronze',gun,vertices=24)
    cylinder('trunnion',(-.30,0,.86),(.30,0,.86),.059,'iron',gun)
    for side in [-1,1]:
        sphere('axle_pin',(side*.68,0,.54),(.055,.067,.067),'bronze',root)
        for y in [-.18,.23,.57]:sphere('carriage_bolt',(side*.264,y,.65),(.015,.024,.024),'iron',root,8,4)
    cylinder('rammer',(.43,.87,.4),(.43,-.65,.72),.023,'wood',root)
    sphere('rammer_head',(.43,-.66,.72),(.047,.087,.047),'linen',root)
    for wheel in wheels:wheel_animation(wheel)
    animate_node(gun,'Engage',[(0,(0,0,0),(0,0,0)),(.15,(-.035,0,0),(0,.15,0)),(.6,(0,0,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
    return root


def tank(early=False):
    root=pivot('unit_root');wheels=[]
    if early:
        outline=[(-1.58,.19),(.97,.19),(1.52,.52),(1.50,1.25),(-.97,1.35),(-1.68,.78)]
        width=.90
        for side in [-1,1]:
            x=side*width
            verts=[(x-.14,y,z) for y,z in outline]+[(x+.14,y,z) for y,z in outline]
            faces=[tuple(reversed(range(6))),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
            mesh('rhomboid_track_frame',verts,faces,'olive',root,False)
            for i,(y,z) in enumerate(outline):
                ny,nz=outline[(i+1)%len(outline)];n=max(2,round(math.hypot(ny-y,nz-z)/.10))
                for j in range(n):
                    t=j/n;link=box('track_plate',(x,y+(ny-y)*t,z+(nz-z)*t),(.37,.095,.045),'dark_metal',root,.004)
                    link.rotation_euler[0]=math.atan2(nz-z,ny-y)
            box('gun_sponson',(side*.70,-.1,.82),(.56,.79,.57),'olive',root,.045)
            cylinder('side_cannon',(side*1.0,-.10,.88),(side*1.50,-.30,.88),.043,'iron',root)
        box('armoured_hull',(0,0,.77),(1.38,2.46,.81),'olive',root,.055)
        box('forward_cabin',(0,-.9,1.22),(.70,.57,.27),'olive',root,.04)
        for x in [-.20,.20]:box('vision_slit',(x,-1.193,1.25),(.19,.012,.043),'black',root,.004)
        turret=root
    else:
        box('lower_hull',(0,.08,.60),(1.54,2.74,.53),'olive',root,.095)
        box('upper_hull',(0,-.09,.96),(1.71,2.25,.33),'olive',root,.10)
        for side in [-1,1]:
            x=side*.91
            for i in range(6):
                y=-1.05+i*.42
                wheel=pivot('road_wheel',(x,y,.48),root)
                cylinder('wheel_disc',(x-.11,y,.48),(x+.11,y,.48),.28,'dark_metal',wheel,vertices=18)
                cylinder('wheel_hub',(x+side*.115,y,.48),(x+side*.13,y,.48),.15,'olive',wheel,vertices=14)
                wheels.append(wheel)
            # Capsule-shaped continuous track made from separate cast links.
            for i in range(52):
                t=i/52*TAU
                y=1.09*math.copysign(1,math.cos(t))+.29*math.cos(t)
                z=.48+.34*math.sin(t)
                if abs(math.sin(t))>.87:y=math.cos(t)*2.2
                link=box('track_link',(x,y,z),(.34,.15,.055),'iron',root,.009)
                link.rotation_euler[0]=math.atan2(.34*math.cos(t),-1.4*math.sin(t))
        turret=pivot('turret',(0,-.12,1.17),root)
        sphere('cast_turret',(0,-.10,1.29),(.65,.69,.31),'olive',turret,24,12)
        cylinder('mantlet',(-.22,-.60,1.29),(.22,-.60,1.29),.18,'olive',turret)
        cylinder('main_gun',(0,-.58,1.30),(0,-2.20,1.34),.065,'olive',turret,vertices=18,radius2=.045)
        cylinder('muzzle',(0,-2.14,1.339),(0,-2.25,1.342),.077,'dark_metal',turret,vertices=18)
        cylinder('commander_hatch',(0,.04,1.55),(0,.04,1.60),.22,'olive',turret,vertices=20)
        tube('hatch_handle',[(-.065,-.02,1.63),(-.065,-.02,1.67),(.065,-.02,1.67),(.065,-.02,1.63)],.009,'iron',turret)
        cylinder('antenna',(.37,.21,1.46),(.41,.25,2.12),.004,'iron',turret,vertices=6)
        for side in [-1,1]:sphere('headlight',(side*.55,-1.20,1.01),(.068,.041,.059),'linen',root)
        for j in range(7):box('engine_louvre',(0,.64+j*.072,1.14),(.66,.027,.018),'dark_metal',root,.003)
        tube('tow_cable',[(-.66,1.23,.91),(-.35,1.37,.87),(.35,1.37,.87),(.66,1.23,.91)],.018,'iron',root)
    for side in [-1,1]:
        for i in range(13):sphere('hull_rivet',(side*.705,-1.10+i*.18,1.13 if not early else 1.18),(.014,.016,.014),'iron',root,8,4)
    for wheel in wheels:wheel_animation(wheel)
    animate_node(root,'March',[(0,(0,0,0),(0,0,0)),(.25,(.008,.008,0),(0,0,.013)),(.5,(0,0,0),(0,0,0)),(.75,(-.008,-.008,0),(0,0,.013)),(1,(0,0,0),(0,0,0))])
    animate_node(turret,'Engage',[(0,(0,0,-.025),(0,0,0)),(.35,(0,0,.04),(0,.015,0)),(.5,(.012,0,.04),(0,.04,0)),(1,(0,0,-.025),(0,0,0))],30)
    return root


def ship(kind='sail'):
    root=pivot('unit_root')
    stations=[(-3.5,.025,.80,-.02),(-2.7,.48,.61,-.42),(-1.5,.74,.57,-.60),(0,.81,.55,-.66),(1.65,.75,.63,-.60),(2.8,.52,.79,-.43),(3.25,.25,.85,-.16)]
    verts=[];steps=12
    for y,w,deck,keel in stations:
        for i in range(steps+1):
            t=math.pi*i/steps
            verts.append((-w*math.cos(t),y,deck-(deck-keel)*math.sin(t)))
    faces=[]
    for j in range(len(stations)-1):
        for i in range(steps):
            a=j*(steps+1)+i;faces.append((a,a+1,a+steps+2,a+steps+1))
    hullmat='iron' if kind=='steam' else 'wood'
    mesh('shaped_hull',verts,faces,hullmat,root)
    deckverts=[]
    for y,w,deck,_ in stations:deckverts.extend([(-w,y,deck),(w,y,deck)])
    mesh('timbered_deck',deckverts,[(i,i+1,i+3,i+2) for i in range(0,len(deckverts)-2,2)],'wood_light',root,False)
    for side in [-1,1]:
        for band in [.04,.22,.44]:
            tube('hull_strake',[(side*w*math.cos(band*math.pi/2),y,deck-(deck-keel)*math.sin(band*math.pi/2)) for y,w,deck,keel in stations],.013,'black' if kind=='steam' else 'wood_light',root)
        tube('gunwale',[(side*w,y,deck+.09) for y,w,deck,keel in stations],.031,'wood_light' if kind!='steam' else 'iron',root)
        for y in [-2.3,-1.75,-1.2,-.65,0,.65,1.2,1.75,2.3]:
            width=.7 if abs(y)<1.7 else .55
            cylinder('railing_stanchion',(side*width,y,.63),(side*width,y,.91),.012,'iron' if kind=='steam' else 'wood',root)
    for i in range(7):
        x=-.51+i*.17
        tube('deck_plank',[(x,-2.5,.65),(x,-1.5,.582),(x,0,.562),(x,1.6,.647),(x,2.3,.747)],.003,'leather',root)
    if kind=='oar':
        for side in [-1,1]:
            for i in range(10):
                y=-2.3+i*.47;x=side*.68
                row=pivot('oar',(x,y,.56),root)
                cylinder('oar_shaft',(side*.22,y,.69),(side*1.55,y-.18,.19),.027,'wood',row)
                paddle=box('oar_blade',(side*1.74,y-.2,.10),(.41,.12,.038),'wood_light',row,.018)
                paddle.rotation_euler[1]=side*.20
                animate_node(row,'March',[(t,(0,side*.045*math.sin(t*TAU),side*.12*math.cos(t*TAU)),(0,0,0)) for t in [0,.25,.5,.75,1]])
        cylinder('ram',(0,-3.15,.2),(0,-3.88,.12),.08,'bronze',root,radius2=.018)
        masts=[(0,2.7,.94)]
    elif kind=='steam':
        box('superstructure',(0,.08,1.0),(.88,2.03,.77),'iron',root,.035)
        box('bridge',(0,-.67,1.50),(1.12,.63,.42),'iron',root,.027)
        for i in range(7):box('bridge_window',(-.43+i*.143,-.995,1.55),(.09,.013,.10),'black',root,.008)
        for y in [.10,.83]:
            cylinder('funnel',(0,y,1.24),(0,y,2.02),.18,'dark_metal',root,vertices=20)
            cylinder('funnel_rim',(0,y,1.98),(0,y,2.08),.20,'iron',root,vertices=20)
        for y in [-2.1,2.1]:
            turret=pivot('naval_turret',(0,y,.81),root)
            box('turret_housing',(0,y,.92),(.73,.61,.39),'iron',turret,.078)
            for x in [-.16,.16]:cylinder('naval_gun',(x,y-.21,1.0),(x,y-1.00,1.05),.038,'dark_metal',turret)
            animate_node(turret,'Engage',[(0,(0,0,-.10),(0,0,0)),(.5,(0,0,.10),(0,0,0)),(1,(0,0,-.10),(0,0,0))],30)
        masts=[(-.8,2.7,.10)]
        for side in [-1,1]:
            for y in [.55,1.15]:sphere('lifeboat',(side*.60,y,1.0),(.13,.34,.10),'wood',root)
    else:
        masts=[(-1.8,3.5,1.06),(.15,4.2,1.35),(1.96,3.25,.9)]
        box('stern_cabin',(0,2.62,.97),(.90,.75,.48),'wood',root,.02)
        for x in [-.29,-.14,0,.14,.29]:box('stern_window',(x,3.00,1.02),(.09,.02,.13),'bronze',root,.006)
        for side in [-1,1]:
            for i in range(9):
                y=-2.10+i*.49;w=.74 if abs(y)<1.6 else .60
                box('gun_port',(side*w,y,.37),(.028,.16,.12),'black',root,.009)
                cylinder('broadside_cannon',(side*(w-.05),y,.39),(side*(w+.22),y,.39),.034,'iron',root)
        cylinder('bowsprit',(0,-2.85,.82),(0,-4.0,1.31),.045,'wood',root,radius2=.021)
    for y,height,width in masts:
        cylinder('mast',(0,y,.56),(0,y,height),.044,'wood' if kind!='steam' else 'iron',root,radius2=.018)
        if kind=='steam':
            cylinder('mast_crossbeam',(-.45,y,2.28),(.45,y,2.28),.025,'iron',root)
            continue
        levels=[(height-.25,.86)] if kind=='oar' else [(height-.30,.70),(height-1.03,.82),(height-1.85,.96)]
        for top,drop in levels:
            if top-drop<.9:continue
            sail_width=width*(.80 if top>height-.5 else 1.0)
            cylinder('yard',(-sail_width*1.09,y,top),(sail_width*1.09,y,top),.024,'wood',root)
            sv=[];count=8
            for row in range(count+1):
                v=row/count
                for col in range(count+1):
                    u=col/count;xx=(u*2-1)*sail_width*(1-.15*v)
                    sv.append((xx,y-.05-.21*math.sin(math.pi*u)*math.sin(math.pi*v),top-v*drop))
            sf=[]
            for row in range(count):
                for col in range(count):
                    a=row*(count+1)+col;sf.append((a,a+1,a+count+2,a+count+1))
            cloth=mesh('billowing_sail',sv,sf,'linen',root)
            solid=cloth.modifiers.new('sail_thickness','SOLIDIFY');solid.thickness=.005
            bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=solid.name)
            for col in [0,2,4,6,8]:tube('sail_seam',[sv[row*(count+1)+col] for row in range(count+1)],.003,'cloth',root)
            for side in [-1,1]:tube('running_rigging',[(side*sail_width,y,top),(side*.58,y+.38,.68)],.007,'leather',root)
        for side in [-1,1]:
            for offset in [-.28,0,.28]:tube('standing_rigging',[(0,y,height-.3),(side*.70,y+offset,.67)],.008,'leather',root)
        # Unmarked pennant: deliberately no invented national flag.
        mesh('plain_pennant',[(0,y,height),(0,y+.47,height-.045),(0,y,height-.12)],[(0,1,2)],'cloth_dark',root,False)
    animate_node(root,'March',[(t,(.012*math.sin(t*TAU),.025*math.sin(t*TAU),0),(0,0,.012*math.cos(t*TAU))) for t in [0,.25,.5,.75,1]])
    animate_node(root,'Engage',[(0,(0,0,0),(0,0,0)),(.35,(.025,.035,0),(0,0,.016)),(.65,(-.018,-.02,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
    return root


def compact_hull(root, width=.70, length=3.0, deck=.45, depth=.65, mat='wood', open_hull=False):
    """Low-resolution curved stations, with a real interior for open boats."""
    stations=[(-1,.04),(-.83,.53),(-.55,.88),(0,1),(.55,.90),(.85,.55),(1,.08)]
    vertices=[]
    for y,w in stations:
        for i in range(9):
            angle=math.pi*i/8
            vertices.append((-width*w*math.cos(angle),y*length,deck+.15*abs(y)**3-depth*math.sin(angle)))
    faces=[(j*9+i,j*9+i+1,(j+1)*9+i+1,(j+1)*9+i) for j in range(6) for i in range(8)]
    hull=mesh('curved_hull',vertices,faces,mat,root,False)
    if open_hull:
        solid=hull.modifiers.new('planked_hull_thickness','SOLIDIFY');solid.thickness=.045
        bpy.context.view_layer.objects.active=hull;bpy.ops.object.modifier_apply(modifier=solid.name)
    else:
        deckverts=[v for j in range(7) for v in (vertices[j*9],vertices[j*9+8])]
        mesh('deck',deckverts,[(i,i+1,i+3,i+2) for i in range(0,12,2)],'wood_light',root,False)
    for side in [-1,1]:
        for band in [0,.35,.70]:
            points=[(side*width*w*math.cos(band),y*length,deck+.15*abs(y)**3-depth*math.sin(band)) for y,w in stations]
            for a,b in zip(points,points[1:]):
                cylinder('hull_strake',a,b,.016,'wood_light' if mat=='wood' else 'iron',root,vertices=6)
    return stations


def naval_motion(root):
    # Both playback phases move the rigid vessel. No casualty mechanism is implied.
    animate_node(root,'March',[(t,(.015*math.sin(t*TAU),.025*math.sin(t*TAU),0),(0,0,.015*math.cos(t*TAU))) for t in [0,.25,.5,.75,1]])
    animate_node(root,'Engage',[(0,(0,0,0),(0,0,0)),(.4,(.025,.03,0),(0,0,.015)),(.7,(-.012,-.02,0),(0,0,0)),(1,(0,0,0),(0,0,0))],30)


def compact_mast(root, y, height, width=.85, sail=False):
    cylinder('mast',(0,y,.45),(0,y,height),.035,'wood',root,vertices=8,radius2=.017)
    for z,factor in [(height-.2,.65),(height-.8,1)]:
        cylinder('yard',(-width*factor,y,z),(width*factor,y,z),.022,'wood',root,vertices=6)
        if sail:
            vertices=[(-width*factor,y,z),(width*factor,y,z),(-width*factor*.9,y-.15,z-.53),(width*factor*.9,y-.15,z-.53)]
            cloth=mesh('square_sail',vertices,[(0,1,3,2)],'linen',root,False)
            solid=cloth.modifiers.new('cloth_thickness','SOLIDIFY');solid.thickness=.009
            bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=solid.name)
    for side in [-1,1]:
        for offset in [-.28,.28]:
            cylinder('standing_rigging',(0,y,height-.15),(side*.60,y+offset,.52),.006,'leather',root,vertices=5)


def compact_funnel(root, y, x=0, height=1.75, radius=.12, base=.5):
    cylinder('funnel',(x,y,base),(x,y,height),radius,'dark_metal',root,vertices=12)
    cylinder('funnel_lip',(x,y,height-.045),(x,y,height+.015),radius*1.10,'iron',root,vertices=12)
    cylinder('funnel_opening',(x,y,height+.016),(x,y,height+.019),radius*.80,'black',root,vertices=12)


def compact_gun(root, x, y, z, side=1):
    box('gun_carriage',(x,y,z-.065),(.18,.20,.10),'wood',root,bevel=0)
    cylinder('gun_barrel',(x-side*.07,y,z),(x+side*.30,y,z),.045,'dark_metal',root,vertices=8,radius2=.031)


def transition_ship(kind):
    """Distinct nineteenth-century mechanisms, never a date-only fleet fallback."""
    root=pivot('unit_root')
    armoured=kind in ['ironclad','casemate','monitor','cruiser','armoured-cruiser']
    compact_hull(root,width=.72 if kind!='monitor' else .80,deck=.38 if kind in ['casemate','monitor'] else .55,depth=.50,mat='iron' if armoured else 'wood')
    if kind in ['corvette','ironclad']:
        for y,height in [(-1.70,2.90),(.25,3.35),(1.95,2.65)]:compact_mast(root,y,height)
        compact_funnel(root,-.55,height=1.72)
        if kind=='ironclad':compact_funnel(root,.65,height=1.72)
        cylinder('bowsprit',(0,-2.85,.68),(0,-3.70,1.03),.037,'wood',root,vertices=8)
        for side in [-1,1]:
            for y in [-1.75,-1.1,-.45,.2,.85,1.5]:
                if kind=='ironclad':box('armoured_gunport',(side*.66,y,.43),(.025,.19,.14),'black',root,bevel=0)
                compact_gun(root,side*.55,y,.62,side)
        box('stern_deckhouse',(0,2.04,.76),(.74,.65,.38),'wood' if kind=='corvette' else 'iron',root,bevel=.015)
    elif kind=='casemate':
        casemate=pivot('sloped_casemate',par=root)
        vertices=[(x,y,z) for z,w,l in [(.39,.70,2.23),(1.07,.46,1.70)] for x,y in [(-w,-l),(w,-l),(w,l),(-w,l)]]
        mesh('armour_planes',vertices,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],'iron',casemate,False)
        for side in [-1,1]:
            for y in [-1.28,-.44,.44,1.28]:
                box('casemate_gunport',(side*.60,y,.71),(.025,.20,.17),'black',casemate,bevel=0)
                compact_gun(casemate,side*.60,y,.73,side)
        for x in [-.22,.22]:compact_funnel(root,.50,x,height=1.93,base=1.03)
        cylinder('pilot_house',(0,-1.25,1.06),(0,-1.25,1.45),.23,'iron',root,vertices=8)
        # City-class boats housed their paddle wheel in the stern of the casemate.
        box('recessed_paddle_housing',(0,2.0,.72),(.69,.80,.52),'dark_metal',root,bevel=0)
    elif kind=='monitor':
        turret=pivot('round_gun_turret',(0,-.50,.43),root)
        cylinder('round_armoured_turret',(0,-.50,.43),(0,-.50,1.08),.58,'iron',turret,vertices=24)
        for x in [-.19,.19]:
            cylinder('turret_gun',(x,-.88,.77),(x,-1.61,.77),.058,'dark_metal',turret,vertices=10)
        for angle in range(16):
            x=.59*math.cos(TAU*angle/16);y=-.50+.59*math.sin(TAU*angle/16)
            cylinder('turret_rivet',(x,y,.57),(x,y,.94),.013,'edge',turret,vertices=5)
        compact_funnel(root,1.0,height=1.45)
        box('low_pilot_house',(0,-2.05,.58),(.40,.44,.38),'iron',root,bevel=.02)
        animate_node(turret,'Engage',[(0,(0,0,-.07),(0,0,0)),(.5,(0,0,.07),(0,0,0)),(1,(0,0,-.07),(0,0,0))],30)
    elif kind=='coastal-paddle':
        # Coastal steam gunboat: clear weather deck and masts, not a tall river cabin.
        for y in [-1.65,1.75]:compact_mast(root,y,2.85,width=.62)
        compact_funnel(root,.05,height=1.80,radius=.13)
        box('low_deckhouse',(0,.35,.77),(.72,1.13,.38),'wood',root,bevel=.015)
        for side in [-1,1]:
            wheel=pivot('coastal_sidewheel',(side*.87,.05,.42),root)
            for i in range(12):
                angle=TAU*i/12
                part=box('paddle_float',(side*.87,.05+math.sin(angle)*.45,.42+math.cos(angle)*.45),(.36,.14,.07),'wood',wheel,bevel=0)
                part.rotation_euler.x=-angle
                cylinder('wheel_spoke',(side*.87,.05,.42),(side*.87,.05+math.sin(angle)*.45,.42+math.cos(angle)*.45),.02,'iron',wheel,vertices=6)
            # Half-circle guards identify external wheels while leaving lower floats visible.
            points=[(side*1.07,.05+math.cos(i*math.pi/12)*.50,.42+math.sin(i*math.pi/12)*.50) for i in range(13)]
            for a,b in zip(points,points[1:]):cylinder('paddle_guard_rim',a,b,.035,'wood_light',root,vertices=6)
            for y in [-1.2,1.1]:compact_gun(root,side*.53,y,.72,side)
            animate_node(wheel,'March',[(t,(t*TAU,0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
    elif kind=='paddle':
        box('riverboat_cabin',(0,.1,.89),(1.06,2.75,.66),'wood_light',root,bevel=.02)
        box('cabin_roof',(0,.1,1.25),(1.17,2.85,.10),'wood',root,bevel=0)
        box('pilot_house',(0,-.70,1.49),(.55,.62,.41),'wood_light',root,bevel=.015)
        for side in [-1,1]:
            for y in [-.80,-.25,.30,.85]:box('cabin_window',(side*.538,y,1.0),(.018,.23,.22),'black',root,bevel=0)
            wheel=pivot('side_paddle_wheel',(side*.82,.45,.38),root)
            for i in range(12):
                angle=TAU*i/12
                part=box('paddle_float',(side*.83,.45+math.sin(angle)*.43,.38+math.cos(angle)*.43),(.34,.14,.08),'wood',wheel,bevel=0)
                part.rotation_euler.x=-angle
                cylinder('wheel_spoke',(side*.83,.45,.38),(side*.83,.45+math.sin(angle)*.43,.38+math.cos(angle)*.43),.022,'iron',wheel,vertices=6)
            animate_node(wheel,'March',[(t,(t*TAU,0,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
        for x in [-.25,.25]:compact_funnel(root,-1.0,x,height=2.08,base=.65)
    elif kind in ['cruiser','armoured-cruiser']:
        box('central_superstructure',(0,.12,.97),(.94,2.24,.62),'iron',root,bevel=.025)
        box('bridge',(0,-.88,1.32),(1.07,.47,.36),'iron',root,bevel=.02)
        for x in [-.35,-.12,.12,.35]:box('bridge_window',(x,-1.12,1.38),(.13,.012,.12),'black',root,bevel=0)
        for y in [-.35,.75]:compact_funnel(root,y,height=2.08,radius=.18,base=1.19)
        for y in [-1.28,1.40]:
            cylinder('military_mast',(0,y,.56),(0,y,2.70),.031,'iron',root,vertices=8,radius2=.016)
            cylinder('fighting_top',(0,y,2.11),(0,y,2.19),.24,'iron',root,vertices=12)
        for y,heading in [(-2.12,0),(2.12,math.pi)]:
            gun=pivot('main_gun_turret' if kind=='armoured-cruiser' else 'shielded_deck_gun',(0,y,.70),root)
            if kind=='armoured-cruiser':
                cylinder('armoured_barbette',(0,y,.56),(0,y,.76),.38,'iron',root,vertices=16)
                cylinder('main_turret_armour',(0,y,.73),(0,y,1.13),.35,'iron',gun,vertices=16)
                animate_node(gun,'Engage',[(0,(0,0,heading-.06),(0,0,0)),(.5,(0,0,heading+.06),(0,0,0)),(1,(0,0,heading-.06),(0,0,0))],30)
            else:box('gun_shield',(0,y-.08,.92),(.57,.29,.45),'iron',gun,bevel=.025)
            cylinder('deck_gun',(0,y-.10,.92),(0,y-.95,.96),.048,'dark_metal',gun,vertices=8)
            gun.rotation_euler.z=heading
        for side in [-1,1]:
            for y in [-.8,.2,1.1]:compact_gun(root,side*.57,y,.75,side)
    for side in [-1,1]:
        for y in [-2.0,-1.3,-.6,.1,.8,1.5,2.2]:
            cylinder('rail_stanchion',(side*.62,y,.57),(side*.62,y,.78),.010,'iron',root,vertices=6)
        cylinder('upper_rail',(side*.62,-2.0,.78),(side*.62,2.2,.78),.010,'iron',root,vertices=6)
    naval_motion(root)
    return root


def specialist_steamer(kind):
    """Working deck, armament and propulsion cues distinguish contemporary roles.

    Compact representative geometry, not an exact ship plan. No guns on transports.
    Torpedoes and mines remain aboard: these clips do not invent historical hits.
    """
    root=pivot('unit_root')
    small=kind in ['torpedo-boat','spar-torpedo-launch','small-steam-gunboat']
    width=.39 if kind=='torpedo-boat' else .48 if small else .69
    length=2.5 if kind in ['spar-torpedo-launch','small-steam-gunboat'] else 3.0
    deck=.36 if small else .56
    compact_hull(root,width=width,length=length,deck=deck,depth=.40 if small else .58,mat='iron')
    if kind in ['torpedo-boat','spar-torpedo-launch']:
        box('low_engine_casing',(0,.15,.54),(width*1.5,1.80,.32),'dark_metal',root,bevel=.025)
        box('wheelhouse',(0,-.80,.69),(.46,.49,.56),'iron',root,bevel=.04)
        for x in [-.13,.13]:box('wheelhouse_window',(x,-1.05,.77),(.17,.012,.13),'black',root,bevel=0)
        for y in ([.0,.7] if kind=='torpedo-boat' else [.35]):compact_funnel(root,y,height=1.26,radius=.10,base=.61)
        for side in [-1,1]:
            for y in [-1.65,1.45]:
                cylinder('ventilator',(side*.25,y,.36),(side*.25,y,.68),.075,'iron',root,vertices=10)
                sphere('ventilator_hood',(side*.25,y-.04,.70),(.095,.12,.085),'iron',root,segments=12,rings=6)
        if kind=='torpedo-boat':
            for y,heading in [(-1.75,.12),(1.90,-.12)]:
                mount=pivot('torpedo_tube_mount',(0,y,.53),root)
                cylinder('tube_pedestal',(0,y,.36),(0,y,.56),.13,'iron',root,vertices=12)
                cylinder('torpedo_tube',(0,y-.46,.63),(0,y+.46,.63),.10,'dark_metal',mount,vertices=16)
                cylinder('tube_breech',(0,y+.40,.63),(0,y+.47,.63),.12,'iron',mount,vertices=16)
                animate_node(mount,'Engage',[(0,(0,0,-heading),(0,0,0)),(.5,(0,0,heading),(0,0,0)),(1,(0,0,-heading),(0,0,0))],30)
        else:
            # Rândunica's spar weapon was a contact charge, not a self-propelled torpedo.
            spar=pivot('spar_torpedo',(0,-1.70,.48),root)
            cylinder('spar',(0,-1.20,.54),(0,-4.42,.04),.037,'wood',spar,vertices=10)
            cylinder('contact_charge',(0,-4.26,.07),(0,-4.66,-.01),.13,'bronze',spar,vertices=12,radius2=.04)
            for side in [-1,1]:
                cylinder('spar_brace',(side*.33,-1.30,.40),(0,-2.35,.36),.02,'iron',root,vertices=8)
            animate_node(spar,'Engage',[(0,(.01,0,0),(0,0,0)),(.5,(-.02,0,0),(0,0,0)),(1,(.01,0,0),(0,0,0))],30)
    else:
        minelayer=kind=='steam-minelayer'
        gunboat=kind=='small-steam-gunboat'
        box('deckhouse',(0,-.25 if minelayer else .05,.595 if gunboat else .97),
            (.68,1.30,.47) if gunboat else (1.00,2.00,.76),'iron',root,bevel=.025)
        bridge_y=-.50 if gunboat else -1.02
        bridge_z=.99 if gunboat else 1.45
        box('bridge',(0,bridge_y,bridge_z),(.77,.43,.32) if gunboat else (1.07,.46,.36),'wood_light',root,bevel=.02)
        for x in [-.25,0,.25]:box('bridge_window',(x,bridge_y-.24,bridge_z+.04),(.16,.013,.13),'black',root,bevel=0)
        for y in ([.15] if gunboat or minelayer else [-.35,.55]):compact_funnel(root,y,height=1.56 if gunboat else 2.12,radius=.11 if gunboat else .17,base=.78 if gunboat else .92)
        for y in ([-1.4,1.35] if gunboat else [-1.65,1.65]):
            h=2.12 if gunboat else 2.5
            cylinder('pole_mast',(0,y,deck),(0,y,h),.025,'wood',root,vertices=8,radius2=.012)
            cylinder('gaff',(0,y,h-.45),(0,y+.47,h-.2),.018,'wood',root,vertices=8)
            for side in [-1,1]:cylinder('mast_stay',(0,y,h-.12),(side*width*.82,y+.23,deck+.04),.006,'leather',root,vertices=5)
        if minelayer:
            # Open stern working deck, parallel rails and secured mine bodies.
            for x in [-.31,.31]:
                cylinder('mine_rail',(x,.85,deck+.045),(x,2.77,deck+.045),.025,'steel',root,vertices=8)
                for y in [1.05,1.53,2.01]:
                    box('mine_cradle',(x,y,.62),(.24,.28,.12),'iron',root,bevel=0)
                    sphere('secured_mine',(x,y,.83),(.16,.16,.16),'dark_metal',root,segments=12,rings=8)
                    for dx,dz in [(-.12,.11),(.12,.11),(0,.18)]:
                        cylinder('mine_contact_horn',(x+dx*.7,y,.83+dz*.7),(x+dx,y,.83+dz),.015,'bronze',root,vertices=6)
        else:
            for side in [-1,1]:
                for y in ([-.1,.65] if gunboat else [-.05,.78]):
                    # Davits and compact lifeboats preserve the merchant/yacht outline.
                    sphere('lifeboat',(side*width*.89,y,1.03 if gunboat else 1.35),(.13,.34,.11),'wood_light',root,segments=12,rings=6)
                    for dy in [-.22,.22]:cylinder('boat_davit',(side*width*.75,y+dy,deck),(side*width*.92,y+dy,1.23 if gunboat else 1.57),.018,'iron',root,vertices=6)
            for side in [-1,1]:
                for y in [-.48,0,.48]:box('cabin_port',(side*(.345 if gunboat else .505),y,.65 if gunboat else 1.09),(.012,.18,.15),'black',root,bevel=0)
        if kind in ['auxiliary-cruiser','small-steam-gunboat']:
            for y,heading in [(-2.10,0),(2.02,math.pi)]:
                gun=pivot('light_deck_gun',(0,y,deck+.10),root)
                cylinder('gun_pedestal',(0,y,deck),(0,y,deck+.20),.13,'iron',root,vertices=12)
                cylinder('light_gun',(0,y+.08,deck+.24),(0,y-.40,deck+.24),.042,'dark_metal',gun,vertices=10)
                animate_node(gun,'Engage',[(0,(0,0,heading-.035),(0,0,0)),(.5,(0,0,heading+.035),(0,0,0)),(1,(0,0,heading-.035),(0,0,0))],30)
    for side in [-1,1]:
        rail_x=width*.83
        for y in [-1.9,-1.2,-.5,.2,.9,1.6,2.0]:
            cylinder('rail_post',(side*rail_x,y,deck),(side*rail_x,y,deck+.20),.009,'iron',root,vertices=6)
        cylinder('deck_rail',(side*rail_x,-1.9,deck+.20),(side*rail_x,2.0,deck+.20),.009,'iron',root,vertices=6)
    naval_motion(root)
    return root


def paddled_ship(egyptian=False):
    root=pivot('unit_root')
    compact_hull(root,width=.57 if egyptian else .43,length=3.0,deck=.52,depth=.67,open_hull=True)
    for y in [-1.9,-1.3,-.7,-.1,.5,1.1,1.7]:
        box('rowing_thwart',(0,y,.45),(.92 if egyptian else .69,.16,.06),'wood_light',root,bevel=0)
    for side in [-1,1]:
        bank=pivot('oar_bank' if egyptian else 'paddle_bank',(side*.40,0,.45),root)
        for i in range(7):
            y=-1.9+i*.6
            cylinder('oar_shaft',(side*.21,y,.60),(side*1.15,y-.30,-.01),.021,'wood',bank,vertices=6)
            bladeobj=box('paddle_blade',(side*1.27,y-.35,-.09),(.29,.13,.045),'wood_light',bank,bevel=0)
            bladeobj.rotation_euler.y=side*.55
        animate_node(bank,'March',[(t,(0,side*.025*math.sin(t*TAU),side*.025*math.cos(t*TAU)),(0,0,.03*math.sin(t*TAU))) for t in [0,.25,.5,.75,1]])
    if egyptian:
        compact_mast(root,.0,2.45,width=1.04,sail=False)
        # Medinet Habu's battle relief shows the sail furled, high ends and steering oars.
        cylinder('furled_sail',(-1.12,0,2.22),(1.12,0,2.22),.085,'linen',root,vertices=10)
        for y,sign in [(-2.85,-1),(2.85,1)]:
            cylinder('raised_end',(0,y,.69),(0,y+sign*.20,1.22),.065,'wood',root,vertices=8,radius2=.04)
        for side in [-1,1]:
            cylinder('steering_oar',(side*.25,2.03,1.13),(side*.64,2.93,-.05),.033,'wood',root,vertices=8)
            box('steering_blade',(side*.64,2.93,-.12),(.20,.36,.045),'wood_light',root,bevel=0)
    naval_motion(root)
    return root


def aircraft(jet=False):
    root=pivot('unit_root')
    fuselage=sphere('aerodynamic_fuselage',(0,0,.45),(.20,1.65,.24),'olive' if not jet else 'iron',root,24,12)
    sphere('cockpit_canopy',(0,-.16,.67),(.17,.40,.18),'blue',root,20,10)
    for y in [-.38,-.13,.09]:tube('canopy_frame',[(-.15,y,.67),(0,y,.85),(.15,y,.67)],.008,'iron',root)
    for side in [-1,1]:
        wingverts=[(side*.12,-.6,.42),(side*2.05,-.18 if not jet else .50,.37),(side*2.15,.19 if not jet else .72,.36),(side*.16,.69,.42)]
        wing=mesh('main_wing',wingverts,[(0,1,2,3)],'olive' if not jet else 'iron',root,False)
        solid=wing.modifiers.new('airfoil_thickness','SOLIDIFY');solid.thickness=.049
        bpy.context.view_layer.objects.active=wing;bpy.ops.object.modifier_apply(modifier=solid.name)
        tube('aileron_hinge',[(side*.75,.47,.45),(side*2.07,.16 if not jet else .7,.395)],.005,'dark_metal',root)
        tail=mesh('tailplane',[(side*.07,1.04,.49),(side*.79,1.40,.50),(side*.71,1.59,.49),(side*.05,1.54,.49)],[(0,1,2,3)],'iron' if jet else 'olive',root,False)
        if jet:
            cylinder('jet_engine',(side*.7,-.53,.29),(side*.7,.96,.29),.15,'iron',root,vertices=20,radius2=.115)
            cylinder('air_intake',(side*.7,-.55,.29),(side*.7,-.559,.29),.121,'black',root,vertices=20)
            cylinder('exhaust',(side*.7,.93,.29),(side*.7,1.02,.29),.12,'dark_metal',root,vertices=20)
        else:
            for i in range(4):box('engine_exhaust',(side*.193,-.89+i*.1,.48),(.043,.045,.027),'dark_metal',root,.009)
    fin=mesh('vertical_stabilizer',[(0,.84,.54),(0,1.18,1.10),(0,1.59,1.05),(0,1.57,.5)],[(0,1,2,3)],'iron' if jet else 'olive',root,False)
    solid=fin.modifiers.new('fin_thickness','SOLIDIFY');solid.thickness=.025
    bpy.context.view_layer.objects.active=fin;bpy.ops.object.modifier_apply(modifier=solid.name)
    if not jet:
        prop=pivot('propeller',(0,-1.65,.45),root)
        sphere('spinner',(0,-1.7,.45),(.12,.19,.12),'iron',prop)
        for angle in [0,TAU/3,TAU*2/3]:
            bladeobj=box('propeller_blade',(math.sin(angle)*.29,-1.65,.45+math.cos(angle)*.29),(.086,.026,.67),'dark_metal',prop,.034)
            bladeobj.rotation_euler[1]=angle
        animate_node(prop,'March',[(t,(0,t*TAU*2,0),(0,0,0)) for t in [0,.125,.25,.375,.5,.625,.75,.875,1]])
        animate_node(prop,'Engage',[(t,(0,t*TAU*2,0),(0,0,0)) for t in [0,.125,.25,.375,.5,.625,.75,.875,1]],30)
    animate_node(root,'March',[(t,(.015*math.sin(t*TAU),.022*math.sin(t*TAU),0),(0,0,.015*math.sin(t*TAU))) for t in [0,.25,.5,.75,1]])
    animate_node(root,'Engage',[(0,(0,-.10,0),(0,0,0)),(.5,(.035,.12,0),(0,0,-.05)),(1,(0,-.10,0),(0,0,0))],30)
    return root


def chariot():
    root=pivot('unit_root')
    for side in [-1,1]:
        horse_root,legs=horse();horse_root.name='draught_horse_'+str(side)
        parent(horse_root,root);horse_root.location=(side*.44,-2.1,0)
        horse_animations(horse_root,legs)
    box('chariot_floor',(0,.27,.70),(1.04,.91,.075),'wood',root,.028)
    for side in [-1,1]:
        wheel=spoked_wheel('chariot_wheel',(side*.64,.34,.60),.57,root)
        wheel_animation(wheel)
        cylinder('draught_shaft',(side*.36,.26,.67),(side*.36,-2.3,.84),.031,'wood',root)
    cylinder('axle',(-.77,.34,.60),(.77,.34,.60),.048,'iron',root)
    # Curved basket front with individual slats and a protective rim.
    for i in range(13):
        t=-math.pi/2+math.pi*i/12;x=math.sin(t)*.49;y=-.08-math.cos(t)*.35
        cylinder('basket_slat',(x,y,.73),(x,y,1.28),.020,'wood_light',root)
    tube('basket_rim',[(math.sin(t)*.49,-.08-math.cos(t)*.35,1.28) for t in [-math.pi/2+math.pi*i/24 for i in range(25)]],.034,'wood',root)
    rig=human('plain','bow',None,root,(0,.23,.73),'charioteer_')
    humanoid_animations(rig,mounted=True)
    return root



def biplane():
    root=pivot('unit_root')
    sphere('fabric_fuselage',(0,.05,.70),(.21,1.42,.22),'linen',root,24,12)
    cylinder('engine_cowling',(0,-1.16,.70),(0,-1.47,.70),.215,'iron',root,vertices=20)
    for y in [-.20,.28]:
        sphere('open_cockpit',(0,y,.892),(.115,.18,.027),'black',root)
        tube('cockpit_rim',[(.12*math.cos(i*TAU/24),y+.18*math.sin(i*TAU/24),.90) for i in range(24)],.012,'leather',root,True)
        sphere('seat_back',(0,y+.11,.88),(.11,.035,.08),'leather',root)
    for z,y in [(.60,0),(1.37,-.12)]:
        for side in [-1,1]:
            sphere('fabric_wing',(side*1.14,y,z),(1.15,.38,.032),'linen',root,24,10)
            for j in range(11):
                x=side*(.20+j*.19)
                tube('wing_rib',[(x,y-.35,z),(x,y,z+.032),(x,y+.35,z)],.003,'wood_light',root)
        for side in [-1,1]:
            cylinder('interplane_strut',(side*1.62,.18,.60),(side*1.62,.06,1.37),.021,'wood',root)
            cylinder('front_interplane_strut',(side*1.62,-.23,.60),(side*1.62,-.35,1.37),.021,'wood',root)
            cylinder('cross_brace',(side*1.62,.18,.61),(side*1.62,-.35,1.36),.004,'iron',root,vertices=5)
            cylinder('cross_brace',(side*1.62,-.23,.61),(side*1.62,.06,1.36),.004,'iron',root,vertices=5)
    for side in [-1,1]:
        cylinder('cabane_strut',(side*.15,-.25,.88),(side*.36,-.32,1.37),.016,'wood',root)
        cylinder('landing_gear',(side*.18,-.55,.61),(side*.43,-.57,.24),.026,'iron',root)
        cylinder('landing_gear_aft',(side*.16,.05,.57),(side*.43,-.57,.24),.026,'iron',root)
        cylinder('undercarriage_wheel',(side*.39,-.57,.23),(side*.49,-.57,.23),.21,'black',root,vertices=24)
        cylinder('wheel_cover',(side*.491,-.57,.23),(side*.496,-.57,.23),.155,'linen',root,vertices=24)
        sphere('tailplane',(side*.51,1.12,.77),(.54,.26,.025),'linen',root)
    sphere('vertical_tail',(0,1.21,.94),(.024,.25,.27),'linen',root)
    tube('tail_skid',[(0,1.15,.52),(0,1.38,.25),(0,1.52,.23)],.02,'wood',root)
    prop=pivot('propeller',(0,-1.49,.70),root)
    cylinder('propeller_hub',(0,-1.46,.70),(0,-1.56,.70),.07,'bronze',prop)
    for side in [-1,1]:
        part=sphere('wooden_propeller',(side*.43,-1.51,.70),(.46,.026,.057),'wood',prop,16,8)
        part.rotation_euler[1]=side*.07
    animate_node(prop,'March',[(t,(0,t*TAU*2,0),(0,0,0)) for t in [0,.25,.5,.75,1]])
    animate_node(root,'March',[(t,(0,.025*math.sin(t*TAU),0),(0,0,.015*math.cos(t*TAU))) for t in [0,.25,.5,.75,1]])
    animate_node(root,'Engage',[(0,(0,-.05,0),(0,0,0)),(.5,(.03,.09,0),(0,0,.08)),(1,(0,-.05,0),(0,0,0))],30)
    return root


def twentieth_century_hull(root, name, half_length, half_beam, deck=.50):
    """New hull only: fine bow, near-parallel midbody, rounded cruiser/carrier stern."""
    group=pivot(name,par=root)
    stations=[(-1,.015),(-.91,.40),(-.72,.81),(-.45,.98),(0,1),(.50,.99),(.78,.88),(.94,.62),(1,.18)]
    vertices=[]
    for y,w in stations:
        for i in range(13):
            t=math.pi*i/12
            vertices.append((-half_beam*w*math.cos(t),y*half_length,deck+.07*abs(y)**3-.71*math.sin(t)))
    mesh('plated_hull',vertices,[(j*13+i,j*13+i+1,(j+1)*13+i+1,(j+1)*13+i) for j in range(8) for i in range(12)],'iron',group)
    top=[v for j in range(9) for v in [vertices[j*13],vertices[j*13+12]]]
    mesh('upper_deck',top,[(i,i+1,i+3,i+2) for i in range(0,16,2)],'wood_light',group,False)
    for side in [-1,1]:
        tube('deck_edge',[(side*half_beam*w,y*half_length,deck+.07*abs(y)**3+.025) for y,w in stations],.017,'steel',group)
        for y in [-.74,-.60,-.46,-.32,-.18,-.04,.10,.24,.38,.52,.66,.78]:
            x=side*half_beam*(.98 if abs(y)<.5 else .88)
            sphere('porthole',(x,y*half_length,deck-.12),(.009,.025,.025),'black',group,8,4)
    return group


def county_cruiser():
    """Cornwall post-refit family: RMG NPA9348 (1937), N8274 (1938).
    Four twin main turrets, three raked funnels and aircraft-handling structure;
    no claim to exact 1941 radar, AA, camouflage or individual deck fittings.
    """
    root=pivot('unit_root')
    twentieth_century_hull(root,'county_hull',3.8,.49)
    for label,y,z,direction in [('A',-2.76,.55,-1),('B',-2.03,.82,-1),('X',2.05,.82,1),('Y',2.82,.55,1)]:
        turret=pivot('county_turret_'+label,(0,y,z),root)
        cylinder('barbette',(0,y,z),(0,y,z+.11),.25,'iron',turret,vertices=16)
        box('twin_gun_housing',(0,y,z+.23),(.55,.47,.28),'steel',turret,.065)
        for side,x in [('port',-.105),('starboard',.105)]:
            gun=pivot('county_gun_'+label+'_'+side,par=turret)
            cylinder('barrel',(x,y+direction*.15,z+.24),(x,y+direction*.87,z+.28),.027,'dark_metal',gun,vertices=10,radius2=.018)
            cylinder('blast_bag',(x,y+direction*.15,z+.24),(x,y+direction*.28,z+.247),.049,'cloth',gun,vertices=10,radius2=.028)
        animate_node(turret,'Engage',[(0,(0,0,0),(0,0,0)),(.45,(0,0,.065),(0,0,0)),(1,(0,0,0),(0,0,0))],30)
    box('forward_deckhouse',(0,-1.28,.86),(.65,1.07,.70),'iron',root,.025)
    box('bridge_lower',(0,-1.30,1.28),(.73,.56,.20),'steel',root,.025)
    box('bridge_upper',(0,-1.26,1.46),(.60,.38,.18),'iron',root,.024)
    for i in range(5):box('bridge_window',(-.235+i*.118,-1.46,1.49),(.073,.012,.062),'black',root,.002)
    for i,y in enumerate([-.63,-.03,.54]):
        funnel=pivot('county_funnel_'+str(i+1),par=root)
        radius=.126 if i!=1 else .153
        cylinder('raked_stack',(0,y,.93),(0,y+.075,1.83),radius,'iron',funnel,vertices=16)
        cylinder('stack_cap',(0,y+.071,1.79),(0,y+.081,1.89),radius*1.10,'dark_metal',funnel,vertices=16)
        cylinder('stack_opening',(0,y+.082,1.891),(0,y+.083,1.894),radius*.84,'black',funnel,vertices=16)
        for side in [-1,1]:cylinder('steam_pipe',(side*radius*.95,y,.95),(side*radius*.95,y+.065,1.76),.012,'steel',funnel,vertices=6)
    hangar=pivot('county_hangar',par=root)
    box('hangar_block',(0,1.47,.94),(.76,.66,.80),'iron',hangar,.02)
    for side in [-1,1]:
        for y in [1.29,1.57]:sphere('hangar_side_opening',(side*.382,y,1.10),(.007,.100,.044),'black',hangar,12,6)
    catapult=pivot('county_catapult',par=root)
    cylinder('catapult_turntable',(0,.97,.55),(0,.97,.75),.16,'iron',catapult,vertices=12)
    for y in [.91,1.03]:cylinder('catapult_rail',(-.62,y,.81),(.62,y,.81),.023,'steel',catapult,vertices=8)
    for x in [-.5,-.25,0,.25,.5]:cylinder('catapult_crosspiece',(x,.91,.81),(x,1.03,.81),.017,'iron',catapult,vertices=6)
    for y,height in [(-1.03,2.55),(1.85,2.36)]:
        cylinder('mast',(0,y,.72),(0,y+.07,height),.024,'iron',root,vertices=10,radius2=.010)
        cylinder('yardarm',(-.37,y+.055,height-.35),(.37,y+.055,height-.35),.012,'steel',root,vertices=6)
        for side in [-1,1]:cylinder('mast_stay',(side*.31,y+.3,.60),(0,y+.06,height-.24),.005,'dark_metal',root,vertices=5)
    for side in [-1,1]:
        crane=pivot('boat_crane',par=root)
        cylinder('crane_pedestal',(side*.39,.60,.55),(side*.39,.60,1.32),.026,'iron',crane,vertices=8)
        cylinder('crane_boom',(side*.39,.60,1.29),(side*.56,1.02,1.14),.018,'steel',crane,vertices=8)
        cylinder('crane_cable',(side*.56,1.02,1.14),(side*.56,1.02,.82),.005,'dark_metal',crane,vertices=5)
        for y in [-.30,.25]:
            sphere('ship_boat',(side*.39,y,.75),(.083,.23,.070),'wood_light',root,12,6)
            sphere('boat_interior',(side*.39,y,.79),(.061,.17,.017),'dark_metal',root,12,6)
        for y in [-3.0,-2.4,-1.8,-.8,0,.8,1.8,2.4,3.0]:
            width=.46 if abs(y)<2.5 else .36
            cylinder('rail_stanchion',(side*width,y,.56),(side*width,y,.68),.007,'steel',root,vertices=5)
        cylinder('deck_rail',(side*.46,-2.4,.68),(side*.46,2.4,.68),.006,'steel',root,vertices=5)
    for y in [-3.37,3.31]:
        box('capstan',(0,y,.60),(.10,.13,.10),'steel',root,.01)
        for x in [-.12,.12]:cylinder('mooring_bollard',(x,y,.55),(x,y,.64),.025,'iron',root,vertices=8)
    naval_motion(root)
    return root


def straight_deck_carrier():
    """1942 carrier-family illustration, not one exact American/Japanese hull.
    NHHC/NARA 80-G-21627, 80-G-16569, 80-G-17031. Generic starboard island
    does not reproduce Akagi/Hiryu port islands or islandless Shoho.
    Deck is empty: the asset never introduces an aircraft count.
    """
    root=pivot('unit_root')
    twentieth_century_hull(root,'carrier_hull',3.98,.63,.46)
    hangar=pivot('carrier_hangar',par=root)
    box('hangar_envelope',(0,.02,.79),(1.21,6.78,.64),'iron',hangar,.05)
    for side in [-1,1]:
        for y in [-2.75,-2.02,-1.29,-.56,.17,.90,1.63,2.36]:
            box('hangar_opening',(side*.612,y,.84),(.015,.46,.23),'dark_metal',hangar,.006)
            cylinder('hangar_frame',(side*.626,y-.26,.53),(side*.626,y-.26,1.11),.014,'steel',hangar,vertices=6)
    deck=pivot('carrier_flight_deck',par=root)
    outline=[(-.68,-4.12),(.68,-4.12),(.90,-3.78),(.90,3.50),(.71,4.12),(-.71,4.12),(-.90,3.50),(-.90,-3.78)]
    verts=[(x,y,z) for z in [1.10,1.20] for x,y in outline]
    mesh('straight_deck_surface',verts,[(8,9,10,11,12,13,14,15),(7,6,5,4,3,2,1,0)]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)],'cloth_dark',deck,False)
    for y,label in [(-2.23,'forward'),(2.02,'aft')]:
        elevator=pivot('carrier_elevator_'+label,par=root)
        box('lift_platform',(0,y,1.204),(.62,.69,.008),'iron',elevator,0)
        for x in [-.32,.32]:cylinder('lift_edge',(x,y-.36,1.211),(x,y+.36,1.211),.006,'steel',elevator,vertices=5)
    for y in [1.03,1.34,1.65,2.56,2.87,3.18]:
        cylinder('arresting_wire',(-.73,y,1.212),(.73,y,1.212),.004,'steel',root,vertices=5)
    for x in [-.83,.83]:cylinder('flight_deck_edge',(x,-3.65,1.205),(x,3.47,1.205),.009,'steel',root,vertices=6)
    island=pivot('carrier_island',par=root)
    box('island_base',(.77,-.67,1.45),(.37,1.41,.48),'iron',island,.035)
    box('island_bridge',(.77,-1.03,1.77),(.43,.57,.20),'steel',island,.024)
    for y in [-1.22,-1.07,-.92]:box('island_window',(.99,y,1.80),(.013,.083,.058),'black',island,.002)
    box('island_funnel',(.79,-.35,1.91),(.29,.47,.48),'iron',island,.06)
    box('funnel_dark_top',(.79,-.35,2.16),(.28,.46,.035),'dark_metal',island,.025)
    cylinder('island_mast',(.76,-1.12,1.84),(.76,-1.12,2.55),.016,'steel',island,vertices=8,radius2=.008)
    cylinder('mast_yard',(.47,-1.12,2.39),(1.02,-1.12,2.39),.009,'steel',island,vertices=6)
    for side in [-1,1]:
        for y in [-2.72,-1.55,.32,1.47,2.65]:
            box('deck_edge_platform',(side*.88,y,.94),(.33,.43,.12),'iron',root,.028)
            cylinder('light_gun_mount',(side*.94,y,1.01),(side*.94,y,1.13),.034,'steel',root,vertices=8)
            cylinder('light_gun',(side*.94,y,1.13),(side*1.12,y,1.22),.012,'dark_metal',root,vertices=8)
            cylinder('platform_brace',(side*.58,y,.58),(side*.95,y,.88),.020,'steel',root,vertices=6)
        for y in [-2.10,1.01]:
            sphere('suspended_ship_boat',(side*.69,y,.65),(.09,.28,.075),'wood_light',root,12,6)
    for y in [-3.72,3.70]:
        for side in [-1,1]:cylinder('flight_deck_support',(side*.42,y,.47),(side*.66,y,1.10),.025,'steel',root,vertices=8)
    naval_motion(root)
    return root


VARIANTS={
    'county-kent-heavy-cruiser':county_cruiser,
    'ww2-straight-deck-carrier':straight_deck_carrier,
    'new-kingdom-oared-ship':lambda:paddled_ship(True), 'lake-war-canoe':lambda:paddled_ship(False),
    'steam-corvette':lambda:transition_ship('corvette'), 'ironclad-warship':lambda:transition_ship('ironclad'),
    'casemate-ironclad':lambda:transition_ship('casemate'), 'monitor-warship':lambda:transition_ship('monitor'),
    'paddle-steamer':lambda:transition_ship('paddle'), 'protected-cruiser':lambda:transition_ship('cruiser'),
    'coastal-paddle-gunboat':lambda:transition_ship('coastal-paddle'),
    'armoured-cruiser':lambda:transition_ship('armoured-cruiser'),
    **{kind:(lambda k=kind:specialist_steamer(k)) for kind in [
        'torpedo-boat','spar-torpedo-launch','auxiliary-cruiser','steam-transport','steam-minelayer','small-steam-gunboat']},
    'biplane-aircraft':biplane,
    'steppe-archer':lambda:mounted(True), 'cavalry-lancer':lambda:mounted(False),
    'field-cannon':cannon, 'early-tank':lambda:tank(True), 'modern-tank':lambda:tank(False),
    'oared-galley':lambda:ship('oar'), 'sailing-warship':lambda:ship('sail'), 'steam-warship':lambda:ship('steam'),
    'propeller-aircraft':lambda:aircraft(False), 'jet-aircraft':lambda:aircraft(True), 'chariot':chariot,
}


HUMANS={
    'prussian-line-infantry-1870':('prussian-1870','dreyse-1862',None),
    'french-line-infantry-1870':('french-1870','chassepot-1866',None),
    'mexican-war-infantry':('mexican-war','india-pattern',None),
    'byzantine-spearman':('byzantine','spear','byzantine'),
    'tercio-pikeman':('tercio','pike',None),
    'civil-war-pikeman':('civil-war-pike','pike',None),
    'republican-infantry':('republican','sword','republican'),
    'persian-spearman':('persian','short-spear','wicker'),
    'longbow-archer':('longbow','longbow',None),
    'medieval-man-at-arms':('plate','sword',None),
    'flintlock-infantry':('tricorne','flintlock',None),
    'british-martini-infantry':('zulu-war-british','martini-henry',None),
    'bengal-matchlock':('mughal','matchlock',None),
    'bengal-sepoy':('mughal','flintlock',None),
    'british-rifle':('british-rifle','bolt-rifle',None),
    'german-rifle':('german-rifle','bolt-rifle',None),
    'french-rifle':('french-rifle','bolt-rifle',None),
    'unclassified-unit':('neutral',None,None),
    'ottoman-musketeer':('ottoman','musket',None),
    'ottoman-ww1-infantry':('ottoman-ww1','mauser-1893',None),
    'mughal-matchlock':('mughal','musket',None),
    'zulu-spearman':('zulu','short-spear','zulu'),
    'representative-infantry':('plain','spear','round'),
    'greek-hoplite':('greek','spear','greek'),
    'roman-infantry':('roman','sword','roman'),
    'han-crossbow':('han','crossbow',None),
    'medieval-infantry':('medieval','sword','medieval'),
    'japanese-matchlock':('east','musket',None),
    'austrian-seven-years-infantry':('austrian-seven-years','austrian-flintlock',None),
    'russian-russo-war-winter-infantry':('russian-russo-winter','mosin-1891',None),
    'japanese-russo-war-winter-infantry':('japanese-russo-winter','type30',None),
    'french-revolution-infantry':('french-revolution','french-1777',None),
    'napoleonic-infantry':('shako','musket',None),
    'musket-infantry':('musket','musket',None),
    'modern-rifle':('rifle','rifle',None),
}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--all',action='store_true');parser.add_argument('--only',default='roman-infantry');parser.add_argument('--preview',type=Path)
    arguments=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    OUTPUT.mkdir(parents=True,exist_ok=True)
    results=[]
    for name in [*HUMANS,*VARIANTS] if arguments.all else arguments.only.split(','):
        reset()
        if name in HUMANS:
            rig=human(*HUMANS[name])
            if arguments.preview:render_preview(arguments.preview)
            humanoid_animations(rig)
        else:
            VARIANTS[name]()
            if arguments.preview:render_preview(arguments.preview)
        results.append(export(name))
    # Keep the inventory accurate after either a full rebuild or one preview export.
    inventory=[inspect_glb(path) for path in sorted(OUTPUT.glob('*.glb'))]
    (OUTPUT/'manifest.json').write_text(json.dumps({'version':1,'assets':inventory},indent=2)+'\n')
    print('TOTAL',json.dumps(results))


if __name__=='__main__':main()
