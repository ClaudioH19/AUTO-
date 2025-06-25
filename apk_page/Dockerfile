# Usar una imagen base de Python
FROM python:3.9-slim

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos locales al contenedor
COPY . /app

# Instalar Flask
RUN pip install flask

# Exponer el puerto en el que Flask servirá la aplicación
EXPOSE 5000

# Ejecutar la aplicación Flask
CMD ["python", "app.py"]
