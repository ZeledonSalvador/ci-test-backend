import pyodbc
import base64
from io import BytesIO
from tkinter import Tk, Label, Button, Frame
from PIL import Image, ImageTk


# Configuración de la base de datos
DB_CONFIG = {
    'host': '*',       # Reemplaza con tu host
    'port': '*',     # Reemplaza con tu puerto
    'user': '*',    # Reemplaza con tu usuario
    'password': '*!',  # Reemplaza con tu contraseña
    'database': '*'
}

# Configuración de paginación
IMAGES_PER_PAGE = 4  # Cambia esto para ver más o menos imágenes por página

# Conexión a SQL Server
def fetch_data():
    conn_str = (
        f'DRIVER={{ODBC Driver 17 for SQL Server}};'
        f'SERVER={DB_CONFIG["host"]},{DB_CONFIG["port"]};'
        f'UID={DB_CONFIG["user"]};PWD={DB_CONFIG["password"]};'
        f'DATABASE={DB_CONFIG["database"]}'
    )
    
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute("SELECT id, file_url FROM ShipmentAttachments")
        rows = cursor.fetchall()
        conn.close()
        return rows
    except Exception as e:
        print(f"Error al conectar a la base de datos: {e}")
        return []

# Decodificación de la imagen base64
def decode_image(base64_string):
    if base64_string.startswith("data:image"):
        base64_string = base64_string.split(",")[1]
    image_data = base64.b64decode(base64_string)
    return Image.open(BytesIO(image_data))

# Interfaz gráfica
class ImageViewer:
    def __init__(self, master, data):
        self.master = master
        self.data = data
        self.page = 0
        self.total_pages = (len(data) - 1) // IMAGES_PER_PAGE + 1
        self.image_refs = []  # Para evitar que las imágenes se borren de la memoria
        
        self.master.title("Visualizador de Imágenes")
        self.frame = Frame(master)
        self.frame.pack()

        self.nav_frame = Frame(master)
        self.nav_frame.pack()

        self.prev_button = Button(self.nav_frame, text="Anterior", command=self.prev_page)
        self.prev_button.grid(row=0, column=0, padx=5)

        self.page_label = Label(self.nav_frame, text=f"Página {self.page + 1} de {self.total_pages}")
        self.page_label.grid(row=0, column=1, padx=5)

        self.next_button = Button(self.nav_frame, text="Siguiente", command=self.next_page)
        self.next_button.grid(row=0, column=2, padx=5)

        self.display_images()

    def display_images(self):
        for widget in self.frame.winfo_children():
            widget.destroy()

        self.image_refs.clear()
        start = self.page * IMAGES_PER_PAGE
        end = start + IMAGES_PER_PAGE

        for idx, (id, file_url) in enumerate(self.data[start:end]):
            try:
                img = decode_image(file_url)
                img.thumbnail((200, 200))  # Ajusta el tamaño de la imagen
                photo = ImageTk.PhotoImage(img)
                self.image_refs.append(photo)
                label = Label(self.frame, image=photo)
                label.grid(row=idx // 2, column=idx % 2, padx=10, pady=10)
            except Exception as e:
                print(f"Error al cargar imagen ID {id}: {e}")

        self.page_label.config(text=f"Página {self.page + 1} de {self.total_pages}")

    def next_page(self):
        if self.page < self.total_pages - 1:
            self.page += 1
            self.display_images()

    def prev_page(self):
        if self.page > 0:
            self.page -= 1
            self.display_images()

if __name__ == "__main__":
    data = fetch_data()
    if data:
        root = Tk()
        app = ImageViewer(root, data)
        root.mainloop()
    else:
        print("No se encontraron datos o no se pudo conectar a la base de datos.")
