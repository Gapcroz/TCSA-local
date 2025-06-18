// utils/validationUtils.js

function validateDataIntegrity(data) {
  const errors = [];
  let isValid = true;

  // Ejemplo de validación simple: verificar si alguna hoja está vacía
  for (const sheetName in data) {
    if (Object.hasOwnProperty.call(data, sheetName)) {
      if (!data[sheetName] || data[sheetName].length === 0) {
        errors.push({
          type: 'empty_sheet',
          message: `La hoja "${sheetName}" está vacía o no contiene datos.`,
          sheet: sheetName,
        });
        isValid = false;
      } else {
        // Ejemplo: Validar que cada objeto en la hoja tenga una propiedad 'Nombre'
        data[sheetName].forEach((row, index) => {
          if (!row.Name && !row.name) { // Asumiendo que esperas un campo 'Name' o 'name'
            errors.push({
              type: 'missing_field',
              message: `Fila ${index + 2} en la hoja "${sheetName}" no tiene el campo "Name".`, // +2 por header y 0-indexed
              sheet: sheetName,
              row: index + 1,
            });
            isValid = false;
          }
          // Más validaciones: tipo de datos, rangos, etc.
          // if (typeof row.Age !== 'number') { ... }
        });
      }
    }
  }

  // Aquí se podrían añadir validaciones más complejas
  // - Unicidad de IDs
  // - Formato de códigos (regex para HTS/ECCN)
  // - Coherencia de unidades

  return { isValid, errors };
}

module.exports = {
  validateDataIntegrity,
};