terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3       = "http://localhost:4566"
    sqs      = "http://localhost:4566"
    dynamodb = "http://localhost:4566"
    iam      = "http://localhost:4566"
    lambda   = "http://localhost:4566"
    sts      = "http://localhost:4566"
  }
}

resource "aws_s3_bucket" "demo" {
  bucket = "tf-localstack-demo-bucket"
}

resource "aws_sqs_queue" "demo" {
  name = "tf-localstack-demo-queue"
}

resource "aws_sqs_queue" "queue_a" {
  name = "queue-a"
}

resource "aws_sqs_queue" "queue_b" {
  name = "queue-b"
}

resource "aws_dynamodb_table" "backend_a_events" {
  name         = "backend_a_events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "backend_b_events" {
  name         = "backend_b_events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "demo" {
  name         = "tf-localstack-demo-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }
}

output "queue_a_url" {
  value = aws_sqs_queue.queue_a.url
}

output "queue_b_url" {
  value = aws_sqs_queue.queue_b.url
}

output "backend_a_events_table_name" {
  value = aws_dynamodb_table.backend_a_events.name
}

output "backend_b_events_table_name" {
  value = aws_dynamodb_table.backend_b_events.name
}
