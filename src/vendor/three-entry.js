import { Scene, Color, FogExp2, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, PlaneGeometry, BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, Vector2, Vector3, Raycaster, MathUtils, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = { Scene, Color, FogExp2, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, PlaneGeometry, BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, Vector2, Vector3, Raycaster, MathUtils, SRGBColorSpace, ACESFilmicToneMapping, mergeGeometries };

import { Sprite, SpriteMaterial, CanvasTexture, NearestFilter, RepeatWrapping, DoubleSide, PCFSoftShadowMap, Matrix4, Quaternion } from 'three';
Object.assign(window.THREE, { Sprite, SpriteMaterial, CanvasTexture, NearestFilter, RepeatWrapping, DoubleSide, PCFSoftShadowMap, Matrix4, Quaternion });

/* Das Spielermodell: geladen wird es aus dem Speicher (GLTFLoader.parse),
   nie ueber das Netz - die Offline-Einzeldatei traegt es als Daten-URI. */
import { AnimationMixer, LoopRepeat, Texture, FrontSide, Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
Object.assign(window.THREE, { AnimationMixer, LoopRepeat, Texture, FrontSide, Box3, GLTFLoader, cloneSkinned });
