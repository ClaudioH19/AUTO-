import sys
import json
from ultralytics import YOLO
import cv2

# Carga el modelo YOLO (usa yolov8n.pt por ser más liviano)
model = YOLO('yolov8n.pt')

# Imagen de entrada (desde Node la guardas como captura.jpg)
imagen_path = 'captura.jpg'

# Detecta objetos
results = model(imagen_path)

# Extrae objetos y dibuja boxes
objects = set()
for r in results:
    boxes = r.boxes
    for i in range(len(boxes)):
        cls_id = int(boxes.cls[i])
        label = r.names[cls_id]
        objects.add(label)

        # Dibuja el cuadro
        xyxy = boxes.xyxy[i].cpu().numpy().astype(int)
        x1, y1, x2, y2 = xyxy
        img = cv2.imread(imagen_path)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 
                    0.5, (0, 255, 0), 2)

        # Sobrescribe cada vez (última versión es la buena)
        cv2.imwrite(imagen_path, img)

# Devuelve los objetos detectados como JSON
print(json.dumps(list(objects)))
