interface ApiResponse<T = any> {
  totalRecords: number; // Total de registros disponibles en la base de datos
  totalPages: number; // Total de páginas que se pueden obtener, basado en 'pageSize'
  page: number; // Página actual
  pageSize: number; // Número de registros por página
  records: T[]; // Los registros actuales de la página solicitada
}
