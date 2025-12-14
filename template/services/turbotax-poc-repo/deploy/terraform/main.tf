// --- minimal AWS demo terraform for TurboTax POC ---

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [coalesce(var.vpc_id, data.aws_vpc.default.id)]
  }
}

resource "aws_ecr_repository" "turbotax" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "turbotax" {
  name              = "/ecs/turbotax-poc"
  retention_in_days = 14
}

# IAM roles for ECS task execution
resource "aws_iam_role" "ecs_exec_role" {
  name = "turbotax-ecs-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_exec_attach" {
  role       = aws_iam_role.ecs_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name               = "turbotax-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_secretsmanager_secret" "turbotax" {
  count = length(keys(var.secrets_map)) > 0 ? 1 : 0
  name  = "turbotax/poc"
}

resource "aws_secretsmanager_secret_version" "turbotax_values" {
  count      = length(keys(var.secrets_map)) > 0 ? 1 : 0
  secret_id  = aws_secretsmanager_secret.turbotax[0].id
  secret_string = jsonencode(var.secrets_map)
}

# ALB
resource "aws_security_group" "alb_sg" {
  name        = "turbotax-alb-sg"
  description = "Allow HTTP to ALB"
  vpc_id      = coalesce(var.vpc_id, data.aws_vpc.default.id)

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "public" {
  name               = "turbotax-poc-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = length(var.public_subnets) > 0 ? var.public_subnets : data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "turbotax_tg" {
  name        = "turbotax-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = coalesce(var.vpc_id, data.aws_vpc.default.id)
  health_check {
    path                = "/health"
    interval            = 30
    unhealthy_threshold = 2
    healthy_threshold   = 2
    matcher             = "200-299"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.turbotax_tg.arn
  }
}

# ECS cluster
resource "aws_ecs_cluster" "turbotax" {
  name = "turbotax-poc-cluster"
}

resource "aws_ecs_task_definition" "turbotax" {
  family                   = "turbotax-poc"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.ecs_exec_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name = "turbotax"
      image = var.container_image != "" ? var.container_image : "${aws_ecr_repository.turbotax.repository_url}:latest"
      portMappings = [ { containerPort = 3000 } ]
      environment = [
        { name = "NODE_ENV", value = "production" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.turbotax.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "turbotax"
        }
      }
      # Map secrets if provided into container env
      secrets = length(keys(var.secrets_map)) > 0 ? [
        for k, _ in var.secrets_map : {
          name = k
          valueFrom = aws_secretsmanager_secret.turbotax[0].arn
        }
      ] : []
    }
  ])
}

resource "aws_ecs_service" "turbotax" {
  name            = "turbotax-poc-service"
  cluster         = aws_ecs_cluster.turbotax.id
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  task_definition = aws_ecs_task_definition.turbotax.arn

  network_configuration {
    subnets         = length(var.public_subnets) > 0 ? var.public_subnets : data.aws_subnets.default.ids
    assign_public_ip = true
    security_groups = []
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.turbotax_tg.arn
    container_name   = "turbotax"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]
  lifecycle { }
}
