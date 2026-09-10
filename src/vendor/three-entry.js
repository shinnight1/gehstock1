import { Scene, Color, FogExp2, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, PlaneGeometry, BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, Vector2, Vector3, Raycaster, MathUtils, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = { Scene, Color, FogExp2, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, PlaneGeometry, BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, Vector2, Vector3, Raycaster, MathUtils, SRGBColorSpace, ACESFilmicToneMapping, mergeGeometries };

import { Sprite, SpriteMaterial, CanvasTexture, NearestFilter, RepeatWrapping, DoubleSide } from 'three';
Object.assign(window.THREE, { Sprite, SpriteMaterial, CanvasTexture, NearestFilter, RepeatWrapping, DoubleSide });
