const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const createdAt = new Date("2025-01-01T09:00:00.000Z");
  const bookingStart = new Date("2025-01-06T10:00:00.000Z");

  const user = await prisma.users.create({
    data: {
      name: "Usuario Demo",
      contact: "demo@example.com",
      created_at: createdAt,
    },
  });

  const service = await prisma.services.create({
    data: {
      name: "Servicio Demo",
      description: "Servicio base de prueba",
      duration_minutes: 60,
      active: true,
      created_at: createdAt,
    },
  });

  await prisma.availability.create({
    data: {
      service_id: service.id,
      day_of_week: "monday",
      start_time: "10:00",
      end_time: "11:00",
      active: true,
    },
  });

  await prisma.bookings.create({
    data: {
      user_id: user.id,
      service_id: service.id,
      start_at: bookingStart,
      status: "confirmed",
      created_at: createdAt,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
