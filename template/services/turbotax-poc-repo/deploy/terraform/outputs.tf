output "ecr_repository_url" {
  value = aws_ecr_repository.turbotax.repository_url
  description = "ECR repository URL (image push target)"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.turbotax.name
}

output "ecs_service_name" {
  value = aws_ecs_service.turbotax.name
}

output "alb_dns" {
  value = aws_lb.public.dns_name
  description = "Public DNS name for ALB; use this as the base url for the microservice (e.g. https://${aws_lb.public.dns_name})"
}
